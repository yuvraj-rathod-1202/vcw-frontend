import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { FiRefreshCw } from "react-icons/fi";

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

       if(joinNotification){
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
          console.log(peerConnections.current[from].signalingState)
          if (peerConnections.current[from].signalingState === "stable") {
            console.error(
              "Cannot set remote offer in state:",
              peerConnections.current[from].signalingState
            );
            return;
          }
          console.log("answer", answer);
          console.log(peerConnections.current[from].signalingState)
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
    container.innerHTML = ""; // Clear existing videos

    Object.entries(remoteStreams.current).forEach(([id, stream]) => {
      const videoElement = document.createElement("video");
      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      container.appendChild(videoElement);
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
    navigate("/"); // Redirect user to another page
  };
  
  let usingFrontCamera = true; // Tracks the current camera state

const changeCamerainMobile = async () => {
  try {
    // Determine the next camera to use
    
    let newStream;
    // Get the new camera stream
    if(usingFrontCamera){
      newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
        facingMode: { ideal: "envitonment" }, // Correctly set facingMode
      },
      audio: true,
    });
  }else{
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



  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      
      <h1 className="absolute top-2 left-2 text-white text-xl z-10">
        Simple Video Call {roomId}
      </h1>
      
      

      <div className="relative w-full h-full">
        <video
          ref={localVideoRef}
          className="absolute bottom-14 right-4 w-36 h-36 object-cover rounded-lg border-2 border-white bg-black"
          autoPlay
          muted
        ></video>

        <div
          id="remote-videos"
          className="absolute inset-0 flex-wrap grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 overflow-auto"
        ></div>
      </div>

      <div className="flex">
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
          <FiRefreshCw />aadsafsdfsf
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
              className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              Screen Share
            </a>
          </li>
          <li>
            <a
    
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
  );
};

export default CreateRoom;
