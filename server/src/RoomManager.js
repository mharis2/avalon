const { customAlphabet } = require('nanoid');
const Room = require('./Room');

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

class RoomManager {
    constructor() {
        this.rooms = new Map();           // code → Room
        this.playerRoomMap = new Map();   // socketId → { roomCode, playerId }
        this.deletionTimers = new Map();  // code → Timeout
    }

    createRoom(hostPlayer, socketId) {
        let code;
        do {
            code = generateCode();
        } while (this.rooms.has(code));

        const room = new Room(code, hostPlayer);
        this.rooms.set(code, room);
        this.playerRoomMap.set(socketId, { roomCode: code, playerId: hostPlayer.id });

        if (this.deletionTimers.has(code)) {
            clearTimeout(this.deletionTimers.get(code));
            this.deletionTimers.delete(code);
        }

        return room;
    }

    joinRoom(code, player, socketId) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room) throw new Error('Room not found');

        room.addPlayer(player);
        this.playerRoomMap.set(socketId, { roomCode: code.toUpperCase(), playerId: player.id });

        if (this.deletionTimers.has(code.toUpperCase())) {
            clearTimeout(this.deletionTimers.get(code.toUpperCase()));
            this.deletionTimers.delete(code.toUpperCase());
        }

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

        // Mark player disconnected instead of removing them completely
        const player = room.getPlayer(mapping.playerId);
        if (player) {
            player.connected = false;
        }

        this.playerRoomMap.delete(socketId);

        // Check if everyone is disconnected
        const allDisconnected = room.players.every(p => !p.connected);

        if (allDisconnected) {
            // Schedule room deletion after 5 minutes (300,000 ms)
            const timer = setTimeout(() => {
                this.rooms.delete(mapping.roomCode);
                this.deletionTimers.delete(mapping.roomCode);
                console.log(`[RoomManager] Deleted empty room ${mapping.roomCode}`);
            }, 300000);
            this.deletionTimers.set(mapping.roomCode, timer);
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

        const room = this.rooms.get(roomCode);
        if (room) {
            const player = room.getPlayer(playerId);
            if (player) player.connected = true;

            // Cancel deletion timer since someone connected
            if (this.deletionTimers.has(roomCode)) {
                clearTimeout(this.deletionTimers.get(roomCode));
                this.deletionTimers.delete(roomCode);
            }
        }

        return room;
    }
}

module.exports = RoomManager;
