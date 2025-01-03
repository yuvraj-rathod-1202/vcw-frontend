import React, { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

const CreateRoom = () => {
  const roomId = useParams();
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socket = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      console.error("Room ID is missing!");
      return;
    }

    socket.current = io("https://vcw-backend.vercel.app", {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.current.emit("join-room", roomId);

    return () => {
      socket.current.disconnect();
    };
  }, [roomId]);

  const config = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302", // STUN server to get public IP
      },
    ],
  };

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      console.log(localStream.current);
      localVideoRef.current.srcObject = stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  };

  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(config);

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("candidate", {
          candidate: event.candidate,
          roomId: roomId,
        });
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      if (!remoteStream.current) {
        remoteStream.current = new MediaStream();
        remoteVideoRef.current.srcObject = remoteStream.current;
      }
      remoteStream.current.addTrack(event.track);
    };

    localStream.current.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStream.current);
    });
  };

  //start call

  const startCall = async () => {
    createPeerConnection();

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);

    socket.current.emit("offer", { offer, roomId });
  };

  useEffect(() => {
    socket.current.on("offer", async (offer) => {
      createPeerConnection();

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socket.current.emit("answer", { answer, roomId });
    });

    socket.current.on("answer", async (answer) => {
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.current.on("candidate", async (candidate) => {
      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    socket.current.on("leave-room", () => {
      if(remoteStream){
        remoteStream.current.getTracks().forEach((track) => track.stop());
        remoteStream.current = null;
      }
  
      if(peerConnectionRef){
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    })
  }, []);

  useEffect(() => {
    getLocalStream();
  }, []);

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
  
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track.kind === "video");
  
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
  
      // Notify others
      socket.current.emit("screen-share-started", { roomId });
  
      // Revert when sharing stops
      screenTrack.onended = async () => {
        const localVideoTrack = localStream.current.getVideoTracks()[0];
        if (sender) {
          sender.replaceTrack(localVideoTrack);
        }
        socket.current.emit("screen-share-stopped", { roomId });
      };
    } catch (error) {
      console.error("Error starting screen sharing:", error);
    }
  };

  const hangUpCall = () => {
    
    if(localStream.current){
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }

    if(remoteStream.current){
      remoteStream.current.getTracks().forEach((track) => track.stop());
      remoteStream.current = null;
    }

    if(peerConnectionRef.current){
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    socket.current.emit("leave-room");
    window.location.reload();
    navigate('/home');
  }
  

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Header */}
      <h1 className="absolute top-2 left-2 text-white text-xl z-10">
        Simple Video Call
      </h1>

      <div className="relative w-full h-full">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          className="absolute inset-0 w-full h-full object-contain"
          autoPlay
        ></video>

        {/* Local Video */}
        <video
          ref={localVideoRef}
          className="absolute bottom-4 right-4 w-36 h-36 object-cover rounded-lg border-2 border-white bg-black"
          autoPlay
          muted
        ></video>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-4">
        <button
          onClick={startCall}
          className="bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600"
        >
          Start Call
        </button>
        <button
          onClick={startScreenShare}
          className="bg-green-500 text-white text-lg font-semibold rounded-lg hover:bg-green-600"
        >
          Screen Share
        </button>
        <button
          onClick={hangUpCall}
          className="bg-red-500 text-white text-lg font-semibold rounded-lg hover:bg-red-600"
        >
          Hang Up
        </button>
      </div>
    </div>
  );
};



export default CreateRoom;
