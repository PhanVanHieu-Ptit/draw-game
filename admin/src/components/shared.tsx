import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Input, Modal, Space, Table } from "antd";
import type { TableProps } from "antd";
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loader()
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loader, revision]);
  return {
    data,
    loading,
    error,
    reload: useCallback(() => setRevision((v) => v + 1), []),
  };
}
export function ErrorState({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <Alert
      type="error"
      showIcon
      message="Unable to load data"
      description={error}
      action={<Button onClick={retry}>Retry</Button>}
    />
  );
}
export function DataTable<T extends { id: string }>({
  search,
  onSearch,
  ...props
}: TableProps<T> & { search: string; onSearch: (v: string) => void }) {
  return (
    <>
      <Input.Search
        aria-label="Filter records"
        placeholder="Filter records…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 320, marginBottom: 20 }}
      />
      <Table<T>
        rowKey="id"
        size="middle"
        scroll={{ x: 650 }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="No records found" /> }}
        {...props}
      />
    </>
  );
}
export function FormModal({
  open,
  title,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
    >
      {children}
    </Modal>
  );
}
export function useNotifications() {
  const { notification } = App.useApp();
  return {
    success: (description: string) =>
      notification.success({ message: "Saved successfully", description }),
    error: (e: unknown) =>
      notification.error({
        message: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  };
}
export function useConfirmation() {
  const { modal } = App.useApp();
  return (title: string, content: string, onOk: () => Promise<void>) =>
    modal.confirm({ title, content, okText: "Confirm", onOk });
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Space className="page-heading" align="start">
      <div>
        <div className="eyebrow">CONTROL CENTER</div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </Space>
  );
}
