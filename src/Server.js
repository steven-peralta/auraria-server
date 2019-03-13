import path from 'path';
import Assets from "./Assets";
import {createServer} from "http";
import socketio from "socket.io";

export default class Server {
    constructor(opts) {
        this.ip = opts? opts.ip : '127.0.0.1';
        this.port = opts? opts.port : '8080';
        this.assetDir = opts? opts.assetsDir : path.join(__dirname, '/assets');
        this.assets = new Assets(this.assetDir);
        this.http = createServer();
        this.socket = socketio(this.http);
    }

    loadAssets() {
        this.assets.loadMaps();
        this.assets.loadTilesheets();
    }

    init() {
        this.loadAssets();
        console.log(this.assets.maps);
        this.http.listen(this.ip, this.port);
        console.log(`listening on ${this.ip}:${this.port}`);
    }
}