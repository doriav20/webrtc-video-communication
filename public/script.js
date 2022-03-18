const socket = io("/")
const chatInputBox = document.getElementById("chat_message");
const allMessages = document.getElementById("all_messages");
const mainChatWindow = document.getElementById("main__chat__window");
const videoGrid = document.getElementById("video-grid")
const myVideo = document.createElement("video");
myVideo.muted = true;

let screenshareEnabled = false;
let cameraEnabledBeforeScreenshare = false;

const peer = new Peer(undefined, {
    path: "/peerjs",
    host: "/",
    port: "3030",
});

let myUserID; //User id
let myUserName; // User name
let myVideoStream; //Camera stream
let myScreenshareStream; //Camera stream
let peers = {};

peer.on("open", (id) => {
    myUserID = id;
    myVideo.id = id;
    document.getElementById("chatTitle").innerHTML = "Chat: " + myUserID;
    socket.emit("joinRoom", ROOM_ID, id);
});

const nameSubmitted = () => {
    myUserName = document.getElementById("username").value;
    if (myUserName) {
        document.getElementById("chatTitle").innerHTML = "Chat: " + myUserName;
        document.getElementById("nameInput").remove();
    }
}

const connectToNewUser = (userId, streams) => {
    const call = peer.call(userId, streams);
    const video = document.createElement("video");
    video.id = userId;
    peers[userId] = call;
    call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
    });
    if (screenshareEnabled) {
        let screen_track = myScreenshareStream.getVideoTracks()[0];
        let sender = call.peerConnection.getSenders().find(s => s.track.kind === screen_track.kind);
        sender.replaceTrack(screen_track);
    }
};

const addVideoStream = (videoEl, stream) => {
    videoEl.srcObject = stream;
    videoEl.addEventListener("loadedmetadata", () => {
        videoEl.play();
    });
    videoGrid.append(videoEl);
    let totalUsers = document.getElementsByTagName("video").length;
    if (totalUsers > 1) {
        for (let index = 0; index < totalUsers; index++) {
            const vids = document.getElementsByTagName("video");
            vids[index].style.width = 100 / totalUsers + "%";
        }
    }
};

navigator.mediaDevices.getUserMedia({video: true, audio: true}).then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on("call", (call) => {
        call.answer(stream);
        const video = document.createElement("video");

        call.on("stream", (userVideoStream) => {
            addVideoStream(video, userVideoStream);
        });
    });

    socket.on("userConnected", (userId) => {
        connectToNewUser(userId, stream);
    });

    socket.on("userDisconnected", (userId) => {
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        let video = document.getElementById(userId);
        if (video) {
            video.remove();
        }
    });
    socket.on("createMessage", (msg) => {
        let listItem = document.createElement("li");
        listItem.innerHTML = msg;
        allMessages.append(listItem);
        mainChatWindow.scrollTop = mainChatWindow.scrollHeight;
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && chatInputBox.value !== "") {
            if (!myUserName) {
                myUserName = myUserID;
            }
            socket.emit("message", chatInputBox.value, myUserName);
            chatInputBox.value = "";
        }
    });
});

peer.on("call", (call) => {
    navigator.mediaDevices.getUserMedia({video: true, audio: true}).then((newUserStream) => {
        call.answer(newUserStream); // Answer the call with an A/V stream.
        const newUserID = call.peer;
        const newUserVideo = document.createElement("video");
        newUserVideo.id = newUserID;
        peers[newUserID] = call;
        call.on("stream", (remoteStream) => {
            addVideoStream(newUserVideo, remoteStream);
        });
    });
});

const takeScreenshotEvent = () => {
    socket.emit("screenshot");
}
const leave = () => {
    myVideoStream.getTracks().forEach(track => {
        track.stop();
    });
    if (screenshareEnabled) {
        myScreenshareStream.getVideoTracks()[0].stop();
    }
    socket.emit("leave");
    document.getElementById("main").remove();
    window.stop();
}

const playPauseVideoEvent = () => {
    let cameraEnabled = myVideoStream.getVideoTracks()[0].enabled;
    if (cameraEnabled) {
        setPlayVideo();
    }
    else {
        if (screenshareEnabled) {
            playPauseScreenshareEvent();
        }
        setStopVideo();
    }
    myVideoStream.getVideoTracks()[0].enabled = !cameraEnabled;
    let lastId = null;
    for (let peer in peers) {
        if (peers[peer]._localStream.id !== lastId) {
            peers[peer]._localStream.getVideoTracks()[0].enabled = !cameraEnabled;
            lastId = peers[peer]._localStream.id;
        }
    }
}

const playPauseScreenshareEvent = () => {
    if (screenshareEnabled) {
        setPlayScreenshare()
        screenshareEnabled = false;
        myScreenshareStream.getVideoTracks()[0].stop();
        let videoTrack = myVideoStream.getVideoTracks()[0];
        Object.keys(peers).forEach(userId => {
            let sender = peers[userId].peerConnection.getSenders().find(sender => sender.track.kind === videoTrack.kind);
            sender.replaceTrack(videoTrack);
        });
        document.getElementById(myUserID + "_screenshare").remove();
        document.getElementById(myUserID).style.display = "block";
        myScreenshareStream = null;
        if (cameraEnabledBeforeScreenshare) {
            playPauseVideoEvent();
        }
    }
    else {
        cameraEnabledBeforeScreenshare = myVideoStream.getVideoTracks()[0].enabled;
        navigator.mediaDevices.getDisplayMedia({cursor: true}).then((stream) => {
            setStopScreenshare();
            myScreenshareStream = stream;
            let screenTrack = myScreenshareStream.getVideoTracks()[0];

            screenTrack.onended = () => {
                setPlayScreenshare();
                screenshareEnabled = false;
                Object.keys(peers).forEach(userId => {
                    let sender = peers[userId].peerConnection.getSenders().find(sender => sender.track.kind === screenTrack.kind);
                    sender.replaceTrack(myVideoStream.getVideoTracks()[0]);
                });
                document.getElementById(myUserID + "_screenshare").remove();
                document.getElementById(myUserID).style.display = "block";
                myScreenshareStream = null;
                if (cameraEnabledBeforeScreenshare) {
                    playPauseVideoEvent();
                }
            }

            Object.keys(peers).forEach(userId => {
                let sender = peers[userId].peerConnection.getSenders().find(sender => sender.track.kind === screenTrack.kind);
                sender.replaceTrack(screenTrack);
            });
            let cameraEnabled = myVideoStream.getVideoTracks()[0].enabled;
            if (cameraEnabled) {
                playPauseVideoEvent();
            }
            const video = document.createElement("video");
            video.id = myUserID + "_screenshare";
            addVideoStream(video, myScreenshareStream);
            document.getElementById(myUserID).after(video);
            document.getElementById(myUserID).style.display = "none";
            screenshareEnabled = true;
        });
    }
}

const copyURL = () => {
    const roomUrl = peer._options.host + ":" + peer._options.port + "/" + ROOM_ID;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(roomUrl);
    }
    else {
        document.addEventListener('copy', (e) => {
            e.clipboardData.setData('text/plain', roomUrl);
            e.clipboardData.setData('text/html', roomUrl);
            e.preventDefault();
        });
        document.execCommand('copy');
    }
}

const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        setUnmuteButton();

    }
    else {
        setMuteButton();
    }
    myVideoStream.getAudioTracks()[0].enabled = !enabled;
    let lastId = null;
    for (let peer in peers) {
        if (peers[peer]._localStream.id !== lastId) {
            peers[peer]._localStream.getAudioTracks()[0].enabled = !enabled;
            lastId = peers[peer]._localStream.id;
        }
    }
};

const setPlayScreenshare = () => {
    const playPauseScreenshareButton = document.getElementById("screenshare");
    const htmlContent = '<i class=" fa fa-tv"></i><span class="">Share Screen</span>';
    playPauseScreenshareButton.innerHTML = htmlContent;
}

const setStopScreenshare = () => {
    const playPauseScreenshareButton = document.getElementById("screenshare");
    const htmlContent = '<i class="unmute fa fa-tv"></i><span class="unmute">Stop Share Screen</span>';
    playPauseScreenshareButton.innerHTML = htmlContent;
}

const setPlayVideo = () => {
    const playPauseVideoButton = document.getElementById("playPauseVideo");
    const htmlContent = '<i class="unmute fa fa-pause-circle"></i><span class="unmute">Resume Video</span>';
    playPauseVideoButton.innerHTML = htmlContent;
};

const setStopVideo = () => {
    const playPauseVideoButton = document.getElementById("playPauseVideo");
    const htmlContent = '<i class=" fa fa-video-camera"></i><span class="">Pause Video</span>';
    playPauseVideoButton.innerHTML = htmlContent;
};

const setUnmuteButton = () => {
    const muteButton = document.getElementById("muteButton");
    const htmlContent = '<i class="unmute fa fa-microphone-slash"></i><span class="unmute">Unmute</span>';
    muteButton.innerHTML = htmlContent;
};

const setMuteButton = () => {
    const muteButton = document.getElementById("muteButton");
    const htmlContent = '<i class="fa fa-microphone"></i><span>Mute</span>';
    muteButton.innerHTML = htmlContent;
};