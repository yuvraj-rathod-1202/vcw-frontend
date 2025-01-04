import React, { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

const CreateRoom = () => {
  const roomId = useParams().id;
  const localStream = useRef(null);
  const remoteStreams = useRef({});
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const socket = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      console.error("Room ID is missing!");
      return;
    }

    const initialize = async () => {
      try {

        await getLocalStream();


        socket.current = io("http://localhost:5000", {
          transports: ["websocket"],
          withCredentials: true,
        });

        socket.current.emit("join-room", { id: roomId });


        socket.current.on("user-joined", async (id) => {
          console.log("User joined with ID:", id);
          if (peerConnections.current[id]) {
            console.warn(`Peer connection already exists for user: ${id}`);
            return;
          }

          if(id !== socket.current.id) {
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
            console.error("Cannot set remote offer in state:", pc.signalingState);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.current.emit("answer", { answer, to: from });
          });


        socket.current.on("answer", async (data) => {
          const { from, answer } = data;
          if (peerConnections.current[from].signalingState === "stable") {
            console.error("Cannot set remote offer in state:", peerConnections.current[from].signalingState);
            return;
          }
          await peerConnections.current[from].setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        });

        socket.current.on("candidate", async (data) => {
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
      // Cleanup: Close all peer connections and disconnect the socket
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      if (socket.current) socket.current.disconnect();
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
      videoElement.style.width = "200px";
      videoElement.style.margin = "5px";
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
      })
      
  
      // Notify others
      socket.current.emit("screen-share-started", { roomId });
  
      // Revert when sharing stops
      screenTrack.onended = async () => {
        const localVideoTrack = localStream.current.getVideoTracks()[0];
        for(let sender of senderarrray) {
          sender.replaceTrack(localVideoTrack);
        }
        socket.current.emit("screen-share-stopped", { roomId });
      };
    } catch (error) {
      console.error("Error starting screen sharing:", error);
    }
  };


  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <h1 className="absolute top-2 left-2 text-white text-xl z-10">
        Simple Video Call
      </h1>

      <div className="relative w-full h-full">
        <video
          ref={localVideoRef}
          className="absolute bottom-4 right-4 w-36 h-36 object-cover rounded-lg border-2 border-white bg-black"
          autoPlay
          muted
        ></video>

        <div id="remote-videos" className="absolute inset-0 flex flex-wrap"></div>
      </div>
      <div>
        <button
          onClick={startScreenShare}
          className="absolute bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          Share Screen
        </button>
      </div>
    </div>
  );
};

export default CreateRoom;
