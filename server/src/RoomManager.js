const { customAlphabet } = require('nanoid');
const Room = require('./Room');

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

class RoomManager {
    constructor() {
        this.rooms = new Map();           // code → Room
        this.playerRoomMap = new Map();   // socketId → { roomCode, playerId }
    }

    createRoom(hostPlayer, socketId) {
        let code;
        do {
            code = generateCode();
        } while (this.rooms.has(code));

        const room = new Room(code, hostPlayer);
        this.rooms.set(code, room);
        this.playerRoomMap.set(socketId, { roomCode: code, playerId: hostPlayer.id });

        return room;
    }

    joinRoom(code, player, socketId) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room) throw new Error('Room not found');

        room.addPlayer(player);
        this.playerRoomMap.set(socketId, { roomCode: code.toUpperCase(), playerId: player.id });

        return room;
    }

    leaveRoom(socketId) {
        const mapping = this.playerRoomMap.get(socketId);
        if (!mapping) return null;

        const room = this.rooms.get(mapping.roomCode);
        if (!room) {
            this.playerRoomMap.delete(socketId);
            return null;
        }

        room.removePlayer(mapping.playerId);
        this.playerRoomMap.delete(socketId);

        // Cleanup empty rooms
        if (room.players.length === 0) {
            this.rooms.delete(mapping.roomCode);
            return { room: null, removed: true, roomCode: mapping.roomCode };
        }

        return { room, removed: false, roomCode: mapping.roomCode };
    }

    getRoom(code) {
        return this.rooms.get(code.toUpperCase());
    }

    getRoomBySocket(socketId) {
        const mapping = this.playerRoomMap.get(socketId);
        if (!mapping) return null;
        return this.rooms.get(mapping.roomCode);
    }

    getPlayerMapping(socketId) {
        return this.playerRoomMap.get(socketId);
    }

    // Reconnection: update socketId for a player
    reconnectPlayer(newSocketId, roomCode, playerId) {
        // Remove old mappings for this playerId in the same room
        for (const [sId, mapping] of this.playerRoomMap.entries()) {
            if (mapping.roomCode === roomCode && mapping.playerId === playerId) {
                this.playerRoomMap.delete(sId);
                break;
            }
        }
        this.playerRoomMap.set(newSocketId, { roomCode, playerId });
        return this.rooms.get(roomCode);
    }
}

module.exports = RoomManager;
