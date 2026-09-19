import { useState } from "react";
import { Modal } from "./Modal";
import { shortAddress } from "../utils/formatters";

export function NicknameModal({
  address,
  nickname,
  onSave,
  onClose,
}: {
  address: string;
  nickname: string;
  onSave: (nickname: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(nickname);
  return (
    <Modal
      title={nickname ? "Edit nickname" : "Name your Smartcrush"}
      onClose={onClose}
      className="nickname-modal"
    >
      <p>{shortAddress(address)}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(value);
        }}
      >
        <label htmlFor="wallet-nickname">Nickname</label>
        <input
          id="wallet-nickname"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={24}
          placeholder="e.g. Pepe Whale"
          autoComplete="off"
          aria-describedby="nickname-help"
        />
        <p id="nickname-help" className="nickname-help">
          Saved on this device. Delete nickname to use the original wallet
          address again.
        </p>
        <button className="button primary" type="submit">
          Save
        </button>
        <button className="button secondary" type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </Modal>
  );
}
