import React from "react";

const ModalItem = ({ item, playIcon = false }) => {
  return (
    <React.Fragment>
      <div
        className="modal-item__artwork"
        style={{
          backgroundImage: `url("${item.podcastArtworkUrl || item.artworkUrl}")`
        }}
      >
        {playIcon ? (
          <svg
            className="modal-item__play-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 250 250"
          >
            <path d="M125,0A125,125,0,1,0,250,125,125,125,0,0,0,125,0ZM85.67,192.79V56.54l118,68.13Z" />
          </svg>
        ) : null}
      </div>

      <div className="modal-item__info">
        <div className="modal-item__title">{item.title}</div>
        <div className="modal-item__author">{item.author}</div>
      </div>
    </React.Fragment>
  );
};

export default ModalItem;