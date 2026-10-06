import * as t from "@babel/types";
import type { NodePath, PluginObj, PluginPass } from "@babel/core";
import { debug } from "@saarthi/core";

export interface SaarthiPluginOptions {
  root?: string;
}

const ENTER = "__saarthi_enter";
const EXIT = "__saarthi_exit";

type FunctionPath = NodePath<
  | t.FunctionDeclaration
  | t.FunctionExpression
  | t.ArrowFunctionExpression
  | t.ObjectMethod
  | t.ClassMethod
  | t.ClassPrivateMethod
>;

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

function instrument(path: FunctionPath, state: PluginPass, options: SaarthiPluginOptions): void {
  const node = path.node;
  const body = node.body;
  if (!t.isBlockStatement(body) && !t.isExpression(body)) return;
  if ((node as { __saarthi?: boolean }).__saarthi) return;
  (node as { __saarthi?: boolean }).__saarthi = true;

  const name = resolveName(path);
  const file = resolveFile(state, options);
  const line = node.loc?.start.line ?? 0;
  debug("babel", "instrument", { name, file, line, type: node.type });

  const sid = path.scope.generateUidIdentifier("saarthi_sid");
  const err = path.scope.generateUidIdentifier("saarthi_err");
  const caughtParam = path.scope.generateUidIdentifier("saarthi_e");

  const statements: t.Statement[] = t.isBlockStatement(body)
    ? body.body
    : [t.returnStatement(body)];

  const enterDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      sid,
      t.callExpression(t.identifier(ENTER), [
        t.stringLiteral(name),
        t.stringLiteral(file),
        t.numericLiteral(line),
      ]),
    ),
  ]);

  const errDecl = t.variableDeclaration("let", [t.variableDeclarator(err)]);

  const catchClause = t.catchClause(
    caughtParam,
    t.blockStatement([
      t.expressionStatement(t.assignmentExpression("=", err, caughtParam)),
      t.throwStatement(caughtParam),
    ]),
  );

  const finallyBlock = t.blockStatement([
    t.expressionStatement(t.callExpression(t.identifier(EXIT), [sid, err])),
  ]);

  const tryStmt = t.tryStatement(
    t.blockStatement(statements),
    catchClause,
    finallyBlock,
  );

  node.body = t.blockStatement([enterDecl, errDecl, tryStmt]);
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
    const obj = memberName(node.object);
    const prop = node.computed ? "…" : memberName(node.property);
    return obj ? `${obj}.${prop}` : prop;
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
