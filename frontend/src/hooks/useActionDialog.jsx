import { useCallback, useState } from "react";

function getInitialInputValue(config) {
  return config.type === "prompt" ? String(config.initialValue || "") : "";
}

export function useActionDialog() {
  const [dialogConfig, setDialogConfig] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const openDialog = useCallback((config) => {
    return new Promise((resolve) => {
      setInputValue(getInitialInputValue(config));
      setError("");
      setSubmitting(false);
      setDialogConfig({
        ...config,
        resolve,
      });
    });
  }, []);

  const confirmAction = useCallback(
    (config) =>
      openDialog({
        confirmLabel: "Xác nhận",
        type: "confirm",
        ...config,
      }),
    [openDialog]
  );

  const promptAction = useCallback(
    (config) =>
      openDialog({
        confirmLabel: "Lưu",
        inputLabel: "Nội dung",
        type: "prompt",
        ...config,
      }),
    [openDialog]
  );

  function closeDialog(result) {
    dialogConfig?.resolve(result);
    setDialogConfig(null);
    setSubmitting(false);
    setError("");
  }

  async function handleConfirm(event) {
    event.preventDefault();

    if (!dialogConfig || submitting) {
      return;
    }

    const value =
      dialogConfig.type === "prompt" ? inputValue.trim() : true;

    if (dialogConfig.type === "prompt" && dialogConfig.required && !value) {
      setError(dialogConfig.requiredMessage || "Vui lòng nhập nội dung.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (dialogConfig.onConfirm) {
        const result = await dialogConfig.onConfirm(value);
        closeDialog(result ?? value);
        return;
      }

      closeDialog(value);
    } catch (actionError) {
      setError(actionError.message || "Không thể hoàn tất thao tác.");
      setSubmitting(false);
    }
  }

  const actionDialog = dialogConfig ? (
    <div className="action-dialog-backdrop" role="presentation">
      <form
        className="action-dialog"
        onSubmit={handleConfirm}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
      >
        <header>
          <h2 id="action-dialog-title">{dialogConfig.title}</h2>
          <button
            type="button"
            aria-label="Đóng"
            disabled={submitting}
            onClick={() => closeDialog(null)}
          >
            ×
          </button>
        </header>

        {dialogConfig.message && <p>{dialogConfig.message}</p>}

        {dialogConfig.type === "prompt" && (
          <label className="action-dialog-field">
            <span>{dialogConfig.inputLabel}</span>
            <textarea
              value={inputValue}
              rows={dialogConfig.rows || 3}
              maxLength={dialogConfig.maxLength || 500}
              placeholder={dialogConfig.placeholder || ""}
              disabled={submitting}
              onChange={(event) => setInputValue(event.target.value)}
              autoFocus
            />
          </label>
        )}

        {error && <p className="action-dialog-error">{error}</p>}

        <footer>
          <button
            type="button"
            className="button secondary"
            disabled={submitting}
            onClick={() => closeDialog(null)}
          >
            {dialogConfig.cancelLabel || "Hủy"}
          </button>
          <button
            type="submit"
            className={dialogConfig.danger ? "button danger" : "button"}
            disabled={submitting}
          >
            {submitting
              ? dialogConfig.loadingLabel || "Đang xử lý..."
              : dialogConfig.confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  ) : null;

  return {
    actionDialog,
    confirmAction,
    promptAction,
  };
}
