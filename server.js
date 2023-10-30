const express = require("express");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");
const screenshot = require("desktop-screenshot");

const app = express();
const server = http.Server(app);
const io = new Server(server);
const peerServer = ExpressPeerServer(server);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/peerjs", peerServer);

app.get("/", (req, rsp) => {
    rsp.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
    res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
    socket.on("joinRoom", (roomId, userId) => {
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("userConnected", userId);

        socket.on("disconnect", () => {
            socket.broadcast.to(roomId).emit("userDisconnected", userId);
        });

        socket.on("message", (message, username) => {
            io.to(roomId).emit("createMessage", username, message);
        });

        socket.on("leave", () => {
            socket.broadcast.to(roomId).emit("userDisconnected", userId);
        });

        socket.on("screenshot", () => {
            screenshot("./screenshot.png", (error, complete) => {});
        });
    });
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
