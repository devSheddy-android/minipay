import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

export default function Dialog({ title, description, busy = false, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === ref.current && !busy) onClose(); }}>
      <div className="dialog-inner">
        <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
        {description && <p className="muted" id={descriptionId}>{description}</p>}
        {children}
      </div>
    </dialog>
  );
}
