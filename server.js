const express = require("express");
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
const io = require("socket.io")(server);
const screenshot = require("desktop-screenshot");

const { ExpressPeerServer } = require("peer");
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
            io.to(roomId).emit("createMessage", username + " :" + message);
        });

        socket.on("leave", () => {
            socket.broadcast.to(roomId).emit("userDisconnected", userId);
        });

        socket.on("screenshot", () => {
            screenshot("./screenshot.png", (error, complete) => {});
        });
    });
});

server.listen(process.env.PORT || 3030);
