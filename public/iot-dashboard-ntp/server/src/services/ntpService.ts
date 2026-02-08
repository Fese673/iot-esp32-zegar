import { Injectable } from 'tsyringe';
import * as dgram from 'dgram';
import { promisify } from 'util';

@Injectable()
export class NTPService {
    private readonly NTP_SERVER = 'pool.ntp.org';
    private readonly NTP_PORT = 123;
    private readonly NTP_TIMEOUT = 5000; // 5 seconds

    private socket: dgram.Socket;

    constructor() {
        this.socket = dgram.createSocket('udp4');
    }

    public async getCurrentTime(): Promise<Date> {
        const message = Buffer.from('1' + '0'.repeat(47)); // NTP request
        const send = promisify(this.socket.send).bind(this.socket);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.socket.close();
                reject(new Error('NTP request timed out'));
            }, this.NTP_TIMEOUT);

            send(message, this.NTP_PORT, this.NTP_SERVER)
                .then(() => {
                    this.socket.on('message', (msg) => {
                        clearTimeout(timeout);
                        this.socket.close();
                        const secondsSince1900 = msg.readUInt32BE(40);
                        const date = new Date((secondsSince1900 - 2208988800) * 1000); // Convert NTP time to JavaScript Date
                        resolve(date);
                    });
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    this.socket.close();
                    reject(error);
                });
        });
    }
}