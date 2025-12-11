import * as assert from "assert";
import * as vscode from "vscode";
import { OperationsTreeDataProvider } from "../../operationsTreeProvider";
import { MCPFilesystemClient } from "../../mcpClient";

suite("Operations Tree Provider Test Suite", () => {
  let provider: OperationsTreeDataProvider;
  let outputChannel: vscode.LogOutputChannel;
  let mockClient: MCPFilesystemClient;

  setup(() => {
    provider = new OperationsTreeDataProvider();
    outputChannel = vscode.window.createOutputChannel("Test Operations Tree", {
      log: true,
    });
    mockClient = new MCPFilesystemClient(outputChannel);
  });

  teardown(() => {
    if (mockClient) {
      mockClient.stop();
    }
    outputChannel.dispose();
  });

  test("Provider should be instantiable", () => {
    assert.ok(provider);
    assert.ok(provider instanceof OperationsTreeDataProvider);
  });

  test("Provider should implement TreeDataProvider interface", () => {
    assert.ok(typeof provider.getTreeItem === "function");
    assert.ok(typeof provider.getChildren === "function");
    assert.ok(provider.onDidChangeTreeData !== undefined);
  });

  test("Provider should have setMCPClient method", () => {
    assert.ok(typeof provider.setMCPClient === "function");
  });

  test("Provider should have refresh method", () => {
    assert.ok(typeof provider.refresh === "function");
  });

  test("setMCPClient should accept client", () => {
    assert.doesNotThrow(() => {
      provider.setMCPClient(mockClient);
    });
  });

  test("setMCPClient should accept undefined", () => {
    assert.doesNotThrow(() => {
      provider.setMCPClient(undefined);
    });
  });

  test("getChildren should return root items", async () => {
    const children = await provider.getChildren();
    assert.ok(Array.isArray(children));
    assert.ok(children.length >= 1);
  });

  test("getChildren should include Quick Actions", async () => {
    provider.setMCPClient(mockClient);
    const children = await provider.getChildren();
    const quickActions = children.find(
      (item) => item.label === "Quick Actions"
    );
    assert.ok(quickActions);
  });

  test("Quick Actions should have child items", async () => {
    provider.setMCPClient(mockClient);
    const rootChildren = await provider.getChildren();
    const quickActions = rootChildren.find(
      (item) => item.label === "Quick Actions"
    );
    assert.ok(quickActions);
    const children = await provider.getChildren(quickActions as any);
    assert.ok(Array.isArray(children));
    assert.ok(children.length > 0);
  });

  test("Quick Actions should include all operations", async () => {
    provider.setMCPClient(mockClient);
    const rootChildren = await provider.getChildren();
    const quickActions = rootChildren.find(
      (item) => item.label === "Quick Actions"
    );
    const children = await provider.getChildren(quickActions as any);
    const labels = children.map((item) => item.label);
    assert.ok(labels.includes("Batch Operations"));
    assert.ok(labels.includes("Watch Directory"));
    assert.ok(labels.includes("Search Files"));
  });

  test("Watch Sessions should display when sessions exist", async () => {
    provider.setMCPClient(mockClient);
    mockClient.recordWatchSession("/test/path", true, ["*.ts"]);
    const children = await provider.getChildren();
    const watchSessions = children.find(
      (item) => item.label === "Active Watch Sessions"
    );
    assert.ok(watchSessions);
  });

  test("Recent Operations should display when operations exist", async () => {
    provider.setMCPClient(mockClient);
    mockClient.recordBatchOperation([
      { type: "copy", source: "/a", destination: "/b" },
    ]);
    const children = await provider.getChildren();
    const recentOps = children.find(
      (item) => item.label === "Recent Operations"
    );
    assert.ok(recentOps);
  });

  test("refresh should fire onDidChangeTreeData event", (done) => {
    provider.onDidChangeTreeData(() => {
      done();
    });
    provider.refresh();
  });
});
