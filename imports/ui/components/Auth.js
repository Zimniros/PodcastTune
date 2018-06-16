import React, { Component } from "react";
import AuthModal from "./helpers/AuthModal";
import Modal from "react-modal";

class Auth extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isModalOpen: false,
      isSignupOpen: false,
      isLoginOpen: false
    };
  }

  closeAuthModal() {
    this.setState({
      isModalOpen: false,
      isLoginOpen: false,
      isSignupOpen: false
    });
  }

  render() {
    return (
      <div className="auth">
        <div
          className="sidebar__link"
          onClick={() =>
            this.setState({
              isModalOpen: true,
              isLoginOpen: true
            })
          }
        >
          Sign In
        </div>
        <div
          className="sidebar__link"
          onClick={() =>
            this.setState({
              isModalOpen: true,
              isSignupOpen: true
            })
          }
        >
          Sing Up
        </div>

        <div className="sidebar__link">Logout</div>

        {this.state.isModalOpen ? (
          <Modal
            isOpen={this.state.isModalOpen}
            onRequestClose={() => this.closeAuthModal()}
            ariaHideApp={false}
          >
            <AuthModal
              isLoginOpen={this.state.isLoginOpen}
              isSignupOpen={this.state.isSignupOpen}
            />
          </Modal>
        ) : null}
      </div>
    );
  }
}

export default Auth;