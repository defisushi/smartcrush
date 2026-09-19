import { HeartCrack } from "lucide-react";
import { Modal } from "./Modal";
import { shortAddress } from "../utils/formatters";
export function BreakUpModal({
  address,
  nickname,
  onClose,
  onConfirm,
}: {
  address: string;
  nickname?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="It’s not you. It’s me."
      onClose={onClose}
      className="breakup-modal"
    >
      <div className="modal-symbol">
        <HeartCrack size={38} />
      </div>
      <p>
        Break up with <strong>{nickname || shortAddress(address)}</strong>? You
        sure?
        <br />
        You might not see them again. :(
      </p>
      <button className="button primary" onClick={onConfirm}>
        Yes, break up
      </button>
      <button className="button secondary" onClick={onClose}>
        Let’s give it another chance
      </button>
    </Modal>
  );
}
