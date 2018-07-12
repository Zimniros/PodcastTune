import React, { Component } from "react";
import { Meteor } from "meteor/meteor";
import { withTracker } from "meteor/react-meteor-data";
import { Link } from "react-router-dom";
import moment from "moment";
import momentDurationFormatSetup from "moment-duration-format";
import Modal from "react-modal";
import UpNextPopup from "./helpers/UpNextPopup";
import EpisodeModal from "./helpers/EpisodeModal";
import { graphql, compose } from "react-apollo";
import getCurrentEpisode from "./../queries/getCurrentEpisode";
import clearCurrentEpisode from "./../queries/clearCurrentEpisode";
import updateCurrentEpisode from "./../queries/updateCurrentEpisode";
import getQueue from "./../queries/getQueue";
import update from "immutability-helper";
import gql from "graphql-tag";

class AudioPlayer extends Component {
  constructor(props) {
    super(props);

    this.player = React.createRef();

    this.state = {
      episode: null,
      isReady: false,
      isPlaying: false,
      mounted: false,
      isLoading: true,
      isMuted: false,
      volume: 1,
      duration: 0,
      playbackRate: 1,
      minPlaybackRate: 0.5,
      maxPlaybackRate: 4,
      playbackStep: 0.1,
      isPopupOpen: false,
      isModalOpen: false
    };

    this.handleEpisodeModal = this.handleEpisodeModal.bind(this);
    this.onQueueItemClick = this.onQueueItemClick.bind(this);
  }

  _lastVolume = 0;

  componentDidMount() {
    const playingEpisode = this.props.playingEpisode;
    this.setState({ mounted: true });
    if (playingEpisode) {
      this.setState(
        { episode: playingEpisode },
        () =>
          (this.player.current.currentTime = this.state.episode.playedSeconds)
      );
    }

    this.updatePlayedSeconds();
    this.getSeconds();
  }

  componentWillUnmount() {
    clearTimeout(this.getSecondsTimeout);
    clearTimeout(this.updatePlayedSecondsTimeout);
  }

  componentWillReceiveProps(nextProps) {
    console.log(this.props);
    const { episode } = this.state;

    if (!nextProps.playingEpisode) {
      this.clearEpisode();
      return;
    }

    if (!episode || episode.mediaUrl !== nextProps.playingEpisode.mediaUrl) {
      this.setState(
        {
          isLoading: true,
          isPlaying: false,
          episode: nextProps.playingEpisode
        },
        () => {
          this.player.current.currentTime =
            nextProps.playingEpisode.playedSeconds;
        }
      );
    }
  }

  getSeconds = () => {
    const { episode } = this.state;
    if (
      episode &&
      this.player.current &&
      this.state.isReady &&
      this.state.isPlaying
    ) {
      this.setState({
        episode: update(this.state.episode, {
          playedSeconds: { $set: +this.player.current.currentTime.toFixed(2) }
        })
      });
    }
    this.getSecondsTimeout = setTimeout(this.getSeconds, 500);
  };

  updatePlayedSeconds = () => {
    const { episode } = this.state;
    if (
      episode &&
      this.player.current &&
      this.state.isReady &&
      this.state.isPlaying
    ) {
      this.props.updatePlayedSeconds({
        variables: {
          id: episode.id,
          podcastId: episode.podcastId,
          playedSeconds: episode.playedSeconds
        }
      });
    }

    this.updatePlayedSecondsTimeout = setTimeout(
      this.updatePlayedSeconds,
      5000
    );
  };

  clearEpisode() {
    const { id, podcastId } = this.state.episode;
    this.setState({
      episode: null,
      isReady: false,
      isPlaying: false,
      duration: 0
    });
    this.props.markAsPlayed({
      variables: {
        id,
        podcastId
      }
    });
    this.props.clearPlayingEpisode({
      refetchQueries: [{ query: GET_PLAYING_EPISODE }, { query: GET_UPNEXT }]
    });
  }

  onReady() {
    this.setState({ isReady: true, isLoading: false }, () => {
      this.onPlay();
    });
  }

  onPlay() {
    if (this.state.isReady) {
      this.setState({ isPlaying: true });
      this.player.current.play();
    }
  }

  onPause() {
    this.setState({ isPlaying: false });
    this.player.current.pause();
  }

  handlePlayPause() {
    if (!this.state.isPlaying) {
      this.onPlay();
    } else {
      this.onPause();
    }
  }

  increasePlaybackRate() {
    const { playbackRate, playbackStep, maxPlaybackRate } = this.state;
    //https://stackoverflow.com/questions/10473994/javascript-adding-decimal-numbers-issue#10474055
    const newRate = +(playbackRate + playbackStep).toFixed(1);
    if (newRate <= maxPlaybackRate) {
      this.setPlaybackRate(newRate);
    }
  }

  decreasePlaybackRate() {
    const { playbackRate, playbackStep, minPlaybackRate } = this.state;
    // https://stackoverflow.com/questions/10473994/javascript-adding-decimal-numbers-issue#10474055
    const newRate = +(playbackRate - playbackStep).toFixed(1);
    if (newRate >= minPlaybackRate) {
      this.setPlaybackRate(newRate);
    }
  }

  setDuration() {
    this.setState({ duration: this.player.current.duration });
  }

  setPlaybackRate(playbackRate) {
    this.setState({ playbackRate }, () => {
      this.player.current.playbackRate = this.state.playbackRate;
    });
  }

  setTime(value) {
    this.setState(
      {
        episode: update(this.state.episode, {
          playedSeconds: { $set: +value.toFixed(2) }
        })
      },
      () => {
        this.player.current.currentTime = this.state.episode.playedSeconds;
      }
    );
  }

  setVolume(volume) {
    const isMuted = volume <= 0;
    if (isMuted !== this.state.isMuted) {
      this.onMute(isMuted);
    } else {
      this._lastVolume = volume !== 0 ? volume : this._lastVolume;
    }
    this.setState({ volume }, () => {
      this.player.current.volume = this.state.volume;
    });
  }

  onMute(isMuted) {
    if (isMuted) {
      this._lastVolume = this.state.volume;
      this.setState({ isMuted: true }, () => {
        this.setVolume(0);
      });
    } else {
      const volume = this._lastVolume > 0 ? this._lastVolume : 0.1;
      this.setState({ isMuted: false }, () => {
        this.setVolume(volume);
      });
    }
  }

  skipTime(amount) {
    const { episode, duration } = this.state;
    if (episode && this.player.current && this.state.isReady) {
      const newTime = +(episode.playedSeconds + amount).toFixed(2);
      if (newTime <= 0) {
        this.setTime(0);
      } else if (newTime >= duration) {
        this.setTime(duration);
      } else {
        this.setTime(newTime);
      }
    }
  }

  handleMute() {
    this.onMute(!this.state.isMuted);
  }

  handleUpNextPopup() {
    this.setState({ isPopupOpen: !this.state.isPopupOpen });
  }

  handleEpisodeModal() {
    this.setState({ isModalOpen: !this.state.isModalOpen });
  }

  onQueueItemClick(episode) {
    this.props.updateCurrentEpisode({
      variables: {
        episode
      }
    });
  }

  formatSeconds(seconds) {
    //TODO fix 0 seconds text
    return moment.duration(seconds > 1 ? seconds : 1, "seconds").format();
  }

  render() {
    const { episode } = this.state;
    return (
      <div className="player">
        <div className="player__controls-left">
          {episode ? (
            <Link
              className="player__link-to-podcast"
              to={`/podcasts/${episode.podcastId}`}
            >
              <img
                className="player__podcast-atrwork"
                src={episode.podcastArtworkUrl}
                alt=""
              />
            </Link>
          ) : null}
          <button
            onClick={() => this.skipTime(-15)}
            className="player__skip player__skip-back"
            disabled={!this.state.isReady}
          >
            <span className="player__skip-text">15</span>
          </button>
          <svg
            className={
              this.state.isPlaying
                ? "player__play player__play--playing"
                : "player__play"
            }
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 250 250"
          >
            <g onClick={() => this.handlePlayPause()}>
              <circle
                className="player__play-circle"
                cx="125"
                cy="125"
                r="115"
                fill="#fff"
              />
              <path d="M125 20A105 105 0 1 1 20 125 105.1 105.1 0 0 1 125 20m0-20A125 125 0 1 0 250 125 125 125 0 0 0 125 0Z" />

              <g className="play__inner">
                <g className="player__play-bars">
                  <rect x="92.5" y="87.5" width="15" height="75" fill="#fff" />
                  <polygon points="117.5 77.5 82.5 77.5 82.5 172.5 117.5 172.5 117.5 77.5 117.5 77.5" />
                  <rect x="142.5" y="87.5" width="15" height="75" fill="#fff" />
                  <polygon points="167.5 77.5 132.5 77.5 132.5 172.5 167.5 172.5 167.5 77.5 167.5 77.5" />
                </g>
                <path
                  className="player__play-triangle"
                  d="M183.3 125 95.9 175.5V74.6Z"
                />
              </g>
            </g>
          </svg>

          <button
            disabled={!this.state.isReady}
            onClick={() => this.skipTime(30)}
            className="player__skip player__skip-forward"
          >
            <span className="player__skip-text">30</span>
          </button>
        </div>

        <div className="player__controls-center">
          <div className="player__title">
            {episode ? (
              <span
                className="player__title-link"
                onClick={() => this.handleEpisodeModal()}
              >
                {episode.title}
              </span>
            ) : (
              <span>Select episode to play</span>
            )}
          </div>
          <div className="player__author">
            {episode ? (
              <span>
                <Link to={`/podcasts/${episode.podcastId}`}>
                  {episode.author}
                </Link>{" "}
                - {moment(episode.pubDate).format("MMM D, YYYY")}
              </span>
            ) : (
              "-"
            )}
          </div>
          <div className="player__seek-bar">
            <input
              className="seek-bar__range"
              onChange={e => this.setTime(Number(e.target.value))}
              value={episode ? episode.playedSeconds : 0}
              type="range"
              min="0"
              max={this.state.duration}
              step="1"
            />
            <div className="seek-bar__time">
              <span className="seek-bar__text seek-bar__text--left">
                {this.state.isReady && !this.state.isLoading
                  ? this.formatSeconds(episode.playedSeconds)
                  : "--/--"}
              </span>
              <span className="seek-bar__text seek-bar__text--right">
                {this.state.isReady && !this.state.isLoading
                  ? this.formatSeconds(this.state.duration)
                  : "--/--"}
              </span>
            </div>
          </div>
        </div>
        <div className="player__controls-right">
          <div className="player__playback-rate">
            <div
              className="playback-rate__control"
              onClick={() => this.increasePlaybackRate()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="playback-rate__button"
                viewBox="0 0 250 250"
              >
                <g data-name="Layer 1">
                  <path d="M125 0A125 125 0 1 0 250 125 125 125 0 0 0 125 0Zm75 138H137.5v62.5h-25V138H50V113h62.5V50.5h25V113H200Z" />
                </g>
              </svg>
            </div>
            <div className="playback-rate__text">
              {this.state.playbackRate}x
            </div>
            <div
              className="playback-rate__control"
              onClick={() => this.decreasePlaybackRate()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="playback-rate__button"
                viewBox="0 0 250 250"
              >
                <g data-name="Layer 1">
                  <path d="M125 0A125 125 0 1 0 250 125 125 125 0 0 0 125 0Zm75 137H50V112H200Z" />
                </g>
              </svg>
            </div>
          </div>
          <div
            className={
              this.state.isMuted
                ? "player__volume player__volume--muted"
                : "player__volume"
            }
          >
            <svg
              className="volume__icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 555.17 442.85"
            >
              <g onClick={() => this.handleMute()}>
                <g className="volume__megaphone" id="volume">
                  <polygon points="145.86 320.5 0.5 320.5 0.5 121.5 147.1 121.5 323.5 0.95 323.5 441.9 145.86 320.5" />
                  <path d="M323,1.89V441L146.27,320.17,146,320H1V122H147.26l.25-.17L323,1.89M324,0,147,121H0V321H145.7L324,442.85V0Z" />
                </g>
                <g className="volume__cross" id="cross">
                  <polygon points="459 251.41 393.95 316.46 363.54 286.05 428.59 221 363.54 155.95 393.95 125.54 459 190.59 524.05 125.54 554.46 155.95 489.41 221 554.46 286.05 524.05 316.46 459 251.41" />
                  <path d="M394,126.25l64.34,64.34.71.71.71-.71,64.34-64.34,29.7,29.7-64.34,64.34-.71.71.71.71,64.34,64.34-29.7,29.7-64.34-64.34-.71-.71-.71.71L394,315.75l-29.7-29.7,64.34-64.34.71-.71-.71-.71L364.25,156l29.7-29.7m130.1-1.42-65,65.06L394,124.83,362.83,156,427.89,221l-65.06,65.05L394,317.17,459,252.11l65,65.06,31.12-31.12L490.11,221,555.17,156l-31.12-31.12Z" />
                </g>
              </g>
            </svg>
            <div className="volume__slider">
              <input
                className="volume__range"
                onChange={e => this.setVolume(Number(e.target.value))}
                value={this.state.volume}
                type="range"
                min="0"
                max="1"
                step="0.1"
              />
            </div>
          </div>
          <div
            className="player__up-next"
            onClick={() => this.handleUpNextPopup()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="up-next__icon"
              viewBox="0 0 251.5 192"
            >
              <g data-name="Layer 1">
                <path d="M225 121H25A25.1 25.1 0 0 1 0 96H0A25.1 25.1 0 0 1 25 71H225a25.1 25.1 0 0 1 25 25h0A25.1 25.1 0 0 1 225 121Zm25.5 46h0a25.1 25.1 0 0 0-25-25H25.5a25.1 25.1 0 0 0-25 25h0a25.1 25.1 0 0 0 25 25h200A25.1 25.1 0 0 0 250.5 167Zm1-142h0a25.1 25.1 0 0 0-25-25H26.5a25.1 25.1 0 0 0-25 25h0a25.1 25.1 0 0 0 25 25h200A25.1 25.1 0 0 0 251.5 25Z" />
              </g>
            </svg>
          </div>
        </div>

        <Modal
          isOpen={this.state.isPopupOpen}
          onRequestClose={() => this.handleUpNextPopup()}
          ariaHideApp={false}
          className="up-next__popup"
          overlayClassName="up-next__popup-overlay"
        >
          <UpNextPopup onQueueItemClick={this.onQueueItemClick} />
        </Modal>

        {this.state.isModalOpen ? (
          <EpisodeModal
            isModalOpen={this.state.isModalOpen}
            handleEpisodeModal={this.handleEpisodeModal}
            episode={this.state.episode}
          />
        ) : null}

        <audio
          style={{ display: "none" }}
          ref={this.player}
          src={episode ? episode.mediaUrl : null}
          onLoadedMetadata={() => this.setDuration()}
          onCanPlay={() => this.onReady()}
          onEnded={() => this.clearEpisode()}
          onPlay={() => this.onPlay()}
          onPause={() => this.onPause()}
          muted={this.state.isMuted}
          preload="metadata"
          autoPlay="false"
          controls
        />
      </div>
    );
  }
}

const UPDATE_PLAYER_SECONDS = gql`
  mutation updatePlayerSeconds($id: String!, $playedSeconds: Float!) {
    updatePlayerSeconds(id: $id, playedSeconds: $playedSeconds) @client
  }
`;
const UPDATE_PLAYED_SECONDS = gql`
  mutation UpdatePlayedSeconds(
    $id: String!
    $podcastId: Int!
    $playedSeconds: Float!
  ) {
    updatePlayedSeconds(
      id: $id
      podcastId: $podcastId
      playedSeconds: $playedSeconds
    )
  }
`;

const SET_CURRENT_EPISODE = gql`
  query Episode($podcastId: Int!, $id: String!) {
    episode(podcastId: $podcastId, id: $id) {
      podcastId
      podcastArtworkUrl
      id
      title
      description
      author
      duration
      pubDate
      linkToEpisode
      playedSeconds
    }
  }
`;

const MARK_AS_PLAYED = gql`
  mutation MarkAsPlayed($podcastId: Int!, $id: String!) {
    markAsPlayed(podcastId: $podcastId, id: $id) {
      id
      podcastId
    }
  }
`;

const MARK_AS_UNPLAYED = gql`
  mutation MarkAsUnplayed($podcastId: Int!, $id: String!) {
    markAsUnplayed(podcastId: $podcastId, id: $id) {
      id
      podcastId
    }
  }
`;

const UPDATE_CURRENT_CLIENT = gql`
  mutation updateCurrentEpisode($episode: Episode!) {
    updateCurrentEpisode(episode: $episode) @client {
      id
      podcastId
      podcastArtworkUrl
      title
      description
      author
      mediaUrl
      playedSeconds
      duration
      pubDate
      linkToEpisode
    }
  }
`;

const GET_PLAYING_EPISODE = gql`
  query PlayingEpisode {
    playingEpisode {
      id
      podcastId
      podcastArtworkUrl
      title
      mediaUrl
      pubDate
      playedSeconds
      author
    }
  }
`;

const CLEAR_PLAYING_EPISODE = gql`
  mutation ClearEpisode {
    clearPlayingEpisode {
      podcastId
      id
    }
  }
`;

const GET_UPNEXT = gql`
  query Upnext {
    upnext {
      id
      podcastId
      podcastArtworkUrl
      title
      author
    }
  }
`;

export default withTracker(() => {
  return { isLoggedIn: !!Meteor.userId() };
})(
  compose(
    graphql(UPDATE_PLAYER_SECONDS, { name: "updatePlayerSeconds" }),
    graphql(GET_PLAYING_EPISODE, {
      skip: props => !props.isLoggedIn,
      props: ({ data: { playingEpisode } }) => ({
        playingEpisode
      })
    }),
    graphql(UPDATE_PLAYED_SECONDS, { name: "updatePlayedSeconds" }),
    graphql(MARK_AS_PLAYED, { name: "markAsPlayed" }),
    graphql(CLEAR_PLAYING_EPISODE, { name: "clearPlayingEpisode" })
  )(AudioPlayer)
);
