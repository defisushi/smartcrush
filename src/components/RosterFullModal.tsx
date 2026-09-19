import { HeartHandshake } from "lucide-react";
import { Modal } from "./Modal";
export function RosterFullModal({
  onClose,
  onRoster,
}: {
  onClose: () => void;
  onRoster: () => void;
}) {
  return (
    <Modal
      title="Your roster is full!"
      onClose={onClose}
      className="roster-full-modal"
    >
      <div className="modal-symbol">
        <HeartHandshake size={40} />
      </div>
      <p>So many crushes, so little room.</p>
      <p>
        Break up with at least 1 Smartcrush to make room for this newer, hotter
        one. We’ll keep this prospect right here for you.
      </p>
      <button className="button primary" onClick={onRoster}>
        Make room in my roster
      </button>
      <button className="button secondary" onClick={onClose}>
        Keep swiping
      </button>
    </Modal>
  );
}
