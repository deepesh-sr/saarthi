import * as t from "@babel/types";
import type { NodePath, PluginObj, PluginPass } from "@babel/core";
import { debug } from "@saarthi/core";

export interface SaarthiPluginOptions {
  root?: string;
}

const RUN = "__saarthi_run";

type FunctionNode =
  | t.FunctionDeclaration
  | t.FunctionExpression
  | t.ArrowFunctionExpression
  | t.ObjectMethod
  | t.ClassMethod
  | t.ClassPrivateMethod;

type FunctionPath = NodePath<FunctionNode>;

const VISITOR_KEY =
  "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod|ClassPrivateMethod";

export default function saarthiPlugin(
  _babel: unknown,
  options: SaarthiPluginOptions = {},
): PluginObj {
  return {
    name: "saarthi",
    visitor: {
      [VISITOR_KEY](path: NodePath, state: PluginPass) {
        instrument(path as FunctionPath, state, options);
      },
    },
  };
}

function instrument(
  path: FunctionPath,
  state: PluginPass,
  options: SaarthiPluginOptions,
): void {
  const node = path.node;
  const body = node.body;
  if (!t.isBlockStatement(body) && !t.isExpression(body)) return;
  if ((node as { __saarthi?: boolean }).__saarthi) return;
  (node as { __saarthi?: boolean }).__saarthi = true;

  if (node.generator) {
    debug("babel", "skip-generator", { type: node.type });
    return;
  }

  const name = resolveName(path);
  const file = resolveFile(state, options);
  const line = node.loc?.start.line ?? 0;

  if (t.isBlockStatement(body) && declaresParamWithVar(node, body)) {
    debug("babel", "skip-var-param", { name, file, line });
    return;
  }

  debug("babel", "instrument", {
    name,
    file,
    line,
    type: node.type,
    async: Boolean(node.async),
  });

  const statements = t.isBlockStatement(body)
    ? [...body.body]
    : [t.returnStatement(body)];
  const directives = t.isBlockStatement(body) ? body.directives : [];

  const wrapper = t.arrowFunctionExpression(
    [],
    t.blockStatement(statements),
    Boolean(node.async),
  );
  (wrapper as { __saarthi?: boolean }).__saarthi = true;

  const call = t.callExpression(t.identifier(RUN), [
    t.stringLiteral(name),
    t.stringLiteral(file),
    t.numericLiteral(line),
    wrapper,
  ]);

  const outer = t.blockStatement([t.returnStatement(call)]);
  outer.directives = directives;
  node.body = outer;
}

function declaresParamWithVar(node: FunctionNode, body: t.BlockStatement): boolean {
  const params = (node as { params?: Array<t.Node> }).params ?? [];
  const names = new Set<string>();
  for (const param of params) collectPatternNames(param, names);
  if (names.size === 0) return false;

  for (const statement of body.body) {
    if (!t.isVariableDeclaration(statement) || statement.kind !== "var") continue;
    for (const declaration of statement.declarations) {
      const declared = new Set<string>();
      collectPatternNames(declaration.id, declared);
      for (const candidate of declared) {
        if (names.has(candidate)) return true;
      }
    }
  }
  return false;
}

function collectPatternNames(node: t.Node, names: Set<string>): void {
  if (t.isIdentifier(node)) {
    names.add(node.name);
  } else if (t.isObjectPattern(node)) {
    for (const property of node.properties) {
      if (t.isObjectProperty(property)) collectPatternNames(property.value, names);
      else if (t.isRestElement(property)) collectPatternNames(property.argument, names);
    }
  } else if (t.isArrayPattern(node)) {
    for (const element of node.elements) {
      if (element) collectPatternNames(element, names);
    }
  } else if (t.isAssignmentPattern(node)) {
    collectPatternNames(node.left, names);
  } else if (t.isRestElement(node)) {
    collectPatternNames(node.argument, names);
  }
}

function resolveName(path: FunctionPath): string {
  const node = path.node;

  if (
    (t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) &&
    node.id
  ) {
    return node.id.name;
  }

  if (t.isObjectMethod(node) || t.isClassMethod(node) || t.isClassPrivateMethod(node)) {
    if (t.isClassMethod(node) && node.kind === "constructor") {
      const classNode = path.parentPath?.parentPath?.node;
      if (
        (t.isClassDeclaration(classNode) || t.isClassExpression(classNode)) &&
        classNode.id
      ) {
        return classNode.id.name;
      }
      return "constructor";
    }
    return keyName(node.key);
  }

  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
    return parent.id.name;
  }
  if (t.isAssignmentExpression(parent)) {
    return memberName(parent.left);
  }
  if (t.isObjectProperty(parent)) {
    return keyName(parent.key);
  }
  if (t.isClassProperty(parent) && parent.key) {
    return keyName(parent.key);
  }
  return "anonymous";
}

function keyName(key: t.Node): string {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key) || t.isNumericLiteral(key)) return String(key.value);
  if (t.isPrivateName(key)) return `#${key.id.name}`;
  return "anonymous";
}

function memberName(node: t.Node): string {
  if (t.isIdentifier(node)) return node.name;
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    const object = memberName(node.object);
    const property = node.computed ? "…" : memberName(node.property);
    return object ? `${object}.${property}` : property;
  }
  return "anonymous";
}

function resolveFile(state: PluginPass, options: SaarthiPluginOptions): string {
  const filename = state.filename ?? "";
  const root = options.root ?? process.cwd();
  if (filename.startsWith(root)) {
    const rel = filename.slice(root.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return filename;
}
