import * as assert from "assert";
import * as vscode from "vscode";
import { SecurityTreeDataProvider } from "../../securityTreeProvider";

suite("Security Tree Provider Test Suite", () => {
  let provider: SecurityTreeDataProvider;

  setup(() => {
    provider = new SecurityTreeDataProvider();
  });

  test("Provider should be instantiable", () => {
    assert.ok(provider);
    assert.ok(provider instanceof SecurityTreeDataProvider);
  });

  test("Provider should implement TreeDataProvider interface", () => {
    assert.ok(typeof provider.getTreeItem === "function");
    assert.ok(typeof provider.getChildren === "function");
    assert.ok(provider.onDidChangeTreeData !== undefined);
  });

  test("Provider should have refresh method", () => {
    assert.ok(typeof provider.refresh === "function");
  });

  test("getChildren should return security items", async () => {
    const children = await provider.getChildren();
    assert.ok(Array.isArray(children));
    assert.ok(children.length > 0);
  });

  test("getChildren should include all security categories", async () => {
    const children = await provider.getChildren();
    const labels = children.map((item) => item.label);
    assert.ok(labels.includes("Workspace Root"));
    assert.ok(labels.includes("Allowed Subdirectories"));
    assert.ok(labels.includes("Blocked Paths"));
    assert.ok(labels.includes("Blocked Patterns"));
    assert.ok(labels.includes("Max File Size"));
    assert.ok(labels.includes("Max Batch Size"));
    assert.ok(labels.includes("Rate Limit"));
  });

  test("Workspace Root should have folder icon", async () => {
    const children = await provider.getChildren();
    const workspaceRoot = children.find(
      (item) => item.label === "Workspace Root"
    );
    assert.ok(workspaceRoot);
    assert.ok(workspaceRoot.iconPath);
    assert.strictEqual(
      (workspaceRoot.iconPath as vscode.ThemeIcon).id,
      "folder"
    );
  });

  test("Allowed Subdirectories should have check icon", async () => {
    const children = await provider.getChildren();
    const allowedSubdirs = children.find(
      (item) => item.label === "Allowed Subdirectories"
    );
    assert.ok(allowedSubdirs);
    assert.strictEqual(
      (allowedSubdirs.iconPath as vscode.ThemeIcon).id,
      "check"
    );
  });

  test("Blocked Paths should have error icon", async () => {
    const children = await provider.getChildren();
    const blockedPaths = children.find(
      (item) => item.label === "Blocked Paths"
    );
    assert.ok(blockedPaths);
    assert.strictEqual((blockedPaths.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("Blocked Patterns should have regex icon", async () => {
    const children = await provider.getChildren();
    const blockedPatterns = children.find(
      (item) => item.label === "Blocked Patterns"
    );
    assert.ok(blockedPatterns);
    assert.strictEqual(
      (blockedPatterns.iconPath as vscode.ThemeIcon).id,
      "regex"
    );
  });

  test("Resource limits should have dashboard icon", async () => {
    const children = await provider.getChildren();
    const maxFileSize = children.find((item) => item.label === "Max File Size");
    assert.ok(maxFileSize);
    assert.strictEqual(
      (maxFileSize.iconPath as vscode.ThemeIcon).id,
      "dashboard"
    );
  });

  test("Items should have tooltips", async () => {
    const children = await provider.getChildren();
    children.forEach((item) => {
      assert.ok(item.tooltip);
    });
  });

  test("refresh should fire onDidChangeTreeData event", (done) => {
    provider.onDidChangeTreeData(() => {
      done();
    });
    provider.refresh();
  });

  test("getChildren should return empty array for non-root elements", async () => {
    const children = await provider.getChildren();
    const workspaceRoot = children[0];
    const subChildren = await provider.getChildren(workspaceRoot as any);
    assert.ok(Array.isArray(subChildren));
    assert.strictEqual(subChildren.length, 0);
  });
});
