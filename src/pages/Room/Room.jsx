import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const Room = () => {
  const roomId = useParams();
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socket = useRef(null);

  useEffect(() => {
    if (!roomId) {
      console.error("Room ID is missing!");
      return;
    }
  
    socket.current = io("http://localhost:5000", {
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
      if(event.candidate) {
        socket.current.emit("candidate", {
          "candidate": event.candidate,
          "roomId": roomId
        });
      }
    }

    peerConnectionRef.current.ontrack = (event) => {
      if(!remoteStream.current) {
        remoteStream.current = new MediaStream();
        remoteVideoRef.current.srcObject = remoteStream.current;
      }
      remoteStream.current.addTrack(event.track);
    }

    localStream.current.getTracks().forEach(track => {
      peerConnectionRef.current.addTrack(track, localStream.current);
    });
  }

  //start call

  const startCall = async () => {
    createPeerConnection();

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);

    socket.current.emit("offer", {offer, roomId});
  }

  useEffect(() => {
    socket.current.on("offer", async (offer) => {
      createPeerConnection();

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socket.current.emit("answer", {answer, roomId});
    });

    socket.current.on("answer", async (answer) => {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.current.on("candidate", async (candidate) => {
      try{
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    })
  }, []);

  useEffect(() => {
    getLocalStream();
  }, []);

  return (      
    <div>
      <h1>Simple Video Call</h1>
      <div>
        <video ref={localVideoRef} autoPlay muted style={videoStyle}></video>
        <video ref={remoteVideoRef} autoPlay style={videoStyle}></video>
      </div>
      <div style={controlsStyle}>
        <button onClick={startCall}>Start Call</button>
      </div>
    </div>
  );
};

const videoStyle = {
  width: "45%",
  margin: "5px",
  border: "1px solid black",
};

const controlsStyle = {
  marginTop: "10px",
};

export default Room;
