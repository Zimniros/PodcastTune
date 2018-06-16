import React from "react";
import ModalItem from "./ModalItem";

const UpNextPopup = ({ queue, onQueueItemClick }) => {
  if (!queue || queue.length === 0) {
    return (
      <div className="up-next__empty">
        <h2 className="up-next__title">Your Up Next is Empty</h2>
        <p className="empty__text">Add some episodes</p>
      </div>
    );
  }
  return (
    <React.Fragment>
      <h2 className="up-next__title">Up Next</h2>
      <div className="modal__list">
        {queue.map(episode => {
          return (
            <div
              key={episode.id}
              className="modal__item"
              onClick={() => onQueueItemClick(episode)}
            >
              <ModalItem item={episode} playIcon={true} />
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
};

export default UpNextPopup;
