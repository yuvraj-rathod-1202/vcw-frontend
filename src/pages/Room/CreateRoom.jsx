import React, { use, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { FiRefreshCw } from "react-icons/fi";

//swiper
import { Swiper, SwiperSlide } from "swiper/react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";

import { Pagination, Navigation } from "swiper/modules";

const CreateRoom = () => {
  const roomId = useParams().id;
  const localStream = useRef(null);
  const remoteStreams = useRef({});
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const socket = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navigate = useNavigate();
  let socketInstance = null;
  let joinNotification = true;

  const getSocket = () => {
    if (!socketInstance) {
      socketInstance = io("https://vcw-backend.onrender.com", {
        transports: ["websocket"],
        withCredentials: true,
      });
    }
    return socketInstance;
  };

  useEffect(() => {
    if (!roomId) {
      console.error("Room ID is missing!");
      return;
    }

    const initialize = async () => {
      try {
        getLocalStream();

        socket.current = getSocket();

        if (joinNotification) {
          joinNotification = false;
          socket.current.emit("join-room", { id: roomId });
        }
        socket.current.on("user-joined", async (id) => {
          console.log("User joined with ID:", id);
          if (peerConnections.current[id]) {
            console.warn(`Peer connection already exists for user: ${id}`);
            return;
          }

          if (id !== socket.current.id) {
            if (!localStream.current) {
              console.error("Local stream is not ready!");
              return;
            }

            createPeerConnection(id);

            const offer = await peerConnections.current[id].createOffer();
            await peerConnections.current[id].setLocalDescription(offer);

            socket.current.emit("offer", { offer, to: id });
            console.log("Sent offer to:", id);
          }
        });

        socket.current.on("offer", async (data) => {
          console.log("Received offer from:", data.from);
          const { from, offer } = data;

          if (!peerConnections.current[from]) {
            createPeerConnection(from);
          }

          const pc = peerConnections.current[from];

          if (pc.signalingState !== "stable") {
            console.error(
              "Cannot set remote offer in state:",
              pc.signalingState
            );
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.current.emit("answer", { answer, to: from });
          console.log("Sent answer to:", from);
        });

        socket.current.on("answer", async (data) => {
          console.log("Received answer from:", data.from);
          const { from, answer } = data;
          console.log(peerConnections.current[from].signalingState);
          if (peerConnections.current[from].signalingState === "stable") {
            console.error(
              "Cannot set remote offer in state:",
              peerConnections.current[from].signalingState
            );
            return;
          }
          console.log("answer", answer);
          console.log(peerConnections.current[from].signalingState);
          await peerConnections.current[from].setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        });

        socket.current.on("candidate", async (data) => {
          console.log("Received ICE candidate from:", data.from);
          const { from, candidate } = data;
          try {
            await peerConnections.current[from].addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        });
      } catch (error) {
        console.error("Error during initialization:", error);
      }
    };

    initialize();

    return () => {
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      if (socket.current && socket.current.connected) {
        socket.current.off();
        socket.current.disconnect();
      }
    };
  }, [roomId]);

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      localVideoRef.current.srcObject = stream;
      console.log("Local stream initialized:", stream.getTracks());
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const createPeerConnection = (id) => {
    const config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };

    peerConnections.current[id] = new RTCPeerConnection(config);

    peerConnections.current[id].onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("candidate", {
          to: id,
          candidate: event.candidate,
        });
      }
    };

    peerConnections.current[id].ontrack = (event) => {
      if (!remoteStreams.current[id]) {
        console.log("Creating new remote stream for:", id);
        remoteStreams.current[id] = new MediaStream();
      }
      remoteStreams.current[id].addTrack(event.track);
      updateRemoteVideos();
    };

    console.log("Adding local stream to peer connection:", id);
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        peerConnections.current[id].addTrack(track, localStream.current);
      });
    } else {
      console.error("Local stream is not initialized yet!");
    }
  };

  const updateRemoteVideos = () => {
    const container = document.getElementById("remote-videos");
    container.innerHTML = "";

    Object.entries(remoteStreams.current).forEach(([id, stream]) => {
      const videoContainer = document.createElement("div");
      videoContainer.classList.add("relative");

      const videoElement = document.createElement("video");
      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.classList.add(
        "w-full",
        "h-full",
        "object-cover",
        "max-h-80",
        "rounded-lg"
      );

      const textElement = document.createElement("p");
      textElement.innerHTML = `<span class="text-green-400">${id}</span>`;
      textElement.classList.add(
        "absolute",
        "bottom-4",
        "left-2",
        "text-white",
        "z-10"
      );

      videoContainer.appendChild(videoElement);
      videoContainer.appendChild(textElement);

      container.appendChild(videoContainer);
    });
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      const senderarrray = [];
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.entries(peerConnections.current).forEach(([id, pc]) => {
        const sender = pc.getSenders().find((s) => s.track.kind === "video");

        if (sender) {
          senderarrray.push(sender);
          sender.replaceTrack(screenTrack);
        }
      });

      // Notify others
      socket.current.emit("screen-share-started", { roomId });

      // Revert when sharing stops
      screenTrack.onended = async () => {
        const localVideoTrack = localStream.current.getVideoTracks()[0];
        for (let sender of senderarrray) {
          sender.replaceTrack(localVideoTrack);
        }
        socket.current.emit("screen-share-stopped", { roomId });
      };
    } catch (error) {
      console.error("Error starting screen sharing:", error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const hangUp = () => {
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
    }
    socket.current.emit("leave-room", { roomId, userId: socket.current.id });
    navigate("/"); // Redirect user to another page
  };

  let usingFrontCamera = true; // Tracks the current camera state

  const changeCamerainMobile = async () => {
    try {
      // Determine the next camera to use

      let newStream;
      // Get the new camera stream
      if (usingFrontCamera) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            facingMode: { ideal: "envitonment" }, // Correctly set facingMode
          },
          audio: true,
        });
      } else {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }, // Correctly set facingMode
          },
          audio: true,
        });
      }

      const senderArray = [];
      const newTrack = newStream.getVideoTracks()[0];

      // Replace tracks for all peer connections
      Object.entries(peerConnections.current).forEach(([id, pc]) => {
        const sender = pc.getSenders().find((s) => s.track.kind === "video");
        if (sender) {
          senderArray.push(sender);
          sender.replaceTrack(newTrack);
        }
      });

      // Update the local video preview element
      if (localVideoRef) {
        localVideoRef.srcObject = newStream; // Update the local video element with the new stream
      }

      // Update the local stream
      localStream.current = newStream;

      // Notify others about the camera change
      socket.current.emit("camera-changed-start", { roomId });

      // Handle track stop (e.g., user turns off camera or stream ends)
      newTrack.onended = async () => {
        const localVideoTrack = localStream.current.getVideoTracks()[0];
        for (let sender of senderArray) {
          sender.replaceTrack(localVideoTrack);
        }
        socket.current.emit("camera-changed-stop", { roomId });
      };

      // Toggle the camera state
      usingFrontCamera = !usingFrontCamera;
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  };

  const sendMessageToRoom = () => {
    const message = document.getElementById("message").value;
    socket.current.emit("sentmessagetoroom", { roomId, message });
    const chatContainer = document.getElementById("chat-container");
    const messageElement = document.createElement("div");
    messageElement.classList.add(
      "p-2",
      "rounded-md",
      "bg-blue-300",
      "mb-2",
      "ml-auto",
      "max-w-sm",
      "px-1",
      "text-right"
    );
    messageElement.innerHTML = `<div><span class="font-semibold text-gray-800">you:</span><strong> ${message} </strong></div>`;
    chatContainer.appendChild(messageElement);
    document.getElementById("message").value = "";
  };

  useEffect(() => {
    socket.current.on("getmessagefromroom", (data) => {
      const { from, message } = data;
      const chatContainer = document.getElementById("chat-container");
      const messageElement = document.createElement("div");
      messageElement.classList.add(
        "p-2",
        "rounded-md",
        "bg-gray-300",
        "mb-2",
        "mr-auto",
        "max-w-sm",
        "px-1",
        "text-left"
      );
      messageElement.innerHTML = `<div><span class="font-semibold text-right bg-white text-gray-800">${from}:</span><strong> ${message} </strong></div>`;
      chatContainer.appendChild(messageElement);
    });

    socket.current.on("user-left", (id) => {
      console.log("User left:", id);
      if (peerConnections.current[id]) {
        peerConnections.current[id].close();
        delete peerConnections.current[id];
      }
      if (remoteStreams.current[id]) {
        delete remoteStreams.current[id];
        updateRemoteVideos();
      }
    });
  }, []);

  const swiperRef = useRef(null);
  const goToChat = () => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(2);
    }
  };

  const swipeToJoinedUsers = () => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(1);
    }
  };

  return (
    <div>
      <Swiper
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        pagination={true}
        modules={[Pagination, Navigation]}
        className="mySwiper"
      >
        <SwiperSlide>
          <div className="relative h-screen w-screen overflow-hidden bg-black">
            <div className="w-full mb-5 text-center relative">
              <h1 className="absolute text-center w-full bg-gray-300 top-2 left-2 text-white text-xl z-10">
                Room:
                <span className="font-semibold text-purple-500"> {roomId}</span>
              </h1>

              <div className="relative w-full h-full mt-16">
                <div className="m-auto">
                  <video
                    ref={localVideoRef}
                    className="w-full max-w-lg h-1/2 object-cover rounded-lg border-2 border-white bg-black z-0"
                    autoPlay
                    muted
                  ></video>
                </div>
              </div>
            </div>

            <div className="flex mt-1">
              <button
                id="dropdownDefaultButton"
                onClick={toggleDropdown}
                aria-expanded={isDropdownOpen}
                className="absolute bottom-6 left-4 text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                type="button"
              >
                Dropdown button
              </button>

              <button
                onClick={changeCamerainMobile}
                className="sm:hidden text-white ml-4 bg-blue-300 hover:bg-blue-400"
              >
                <FiRefreshCw />
              </button>
            </div>

            <div
              id="dropdown"
              className={`absolute bottom-28 left-4 z-10 ${
                isDropdownOpen ? "block" : "hidden"
              } bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700`}
            >
              <ul className="py-2 text-sm text-gray-700 dark:text-gray-200">
                <li>
                  <a
                    onClick={startScreenShare}
                    className="hidden md:block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    Screen Share
                  </a>
                </li>
                <li>
                  <a
                    onClick={swipeToJoinedUsers}
                    className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    Joined Users
                  </a>
                </li>
                <li>
                  <a
                    onClick={goToChat}
                    className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    Chat
                  </a>
                </li>
                <li>
                  <a
                    onClick={hangUp}
                    className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    Hang Up
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="relative h-screen w-screen overflow-hidden bg-black">
            <h1 className="text-xl mb-1 text-center font-medium text-black bg-gray-300">
              Room : {roomId}
            </h1>
            <div className="relative w-full h-full">
              <div
                id="remote-videos"
                className="absolute inset-0 flex-wrap grid grid-cols-1 mt-2 sm:grid-cols-2 md:grid-cols-3 grid-rows-2 lg:grid-cols-4 gap-4 p-4 overflow-auto overflow-y-auto"
              ></div>
            </div>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div>
            <h1 className="text-xl mb-1 text-center font-medium text-black bg-gray-300">
              Chat with Room
            </h1>
            <hr />
            <div
              className="flex flex-col mb-1 h-[calc(100vh-110px)] overflow-y-auto"
              id="chat-container"
            ></div>
            <hr />
            <div className="flex flex-row items-center p-4 justify-center space-x-4 bg-neutral-100">
              <input
                type="text"
                id="message"
                className="p-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
                placeholder="Type a message"
              />
              <button
                onClick={sendMessageToRoom}
                className="py-2 px-4 bg-blue-500 text-white font-bold rounded-md"
              >
                Send
              </button>
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};

export default CreateRoom;
