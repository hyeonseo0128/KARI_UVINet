const dgram = require('dgram');
const { SerialPort } = require('serialport');
const os = require('os');
const fs = require("fs");
const broadcastAddress = require('broadcast-address');

const UCAST_HOST = '127.0.0.1';
const UCAST_PORT = 20002;
const BCAST_HOST = broadcastAddress('eth0');
const BCAST_PORT = 20004;
const SERIAL_PORT = '/dev/ttyTHS1';
const BAUD_RATE = 115200;

const udpSocket = dgram.createSocket('udp4');
const bcastSocket = dgram.createSocket('udp4');

const serialPort = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE
});

const net_int = os.networkInterfaces();
const MY_IP_ADDRESS = net_int['eth0'][0].address;
console.log('my ip address:', MY_IP_ADDRESS);

let id_ip_dic = {};
try {
    id_ip_dic = JSON.parse(fs.readFileSync('./id_ip_dic.json', 'utf8'));
} catch (e) {
    console.log('id_ip_dic file not exist.');
}
// console.log(id_ip_dic);

udpSocket.on('message', (message, rinfo) => {
    console.log('udpsocket received:', rinfo.address, rinfo.port, 'message:', message.toString('hex'));
    if (rinfo.address == MY_IP_ADDRESS) {
        console.log('ucasts my ip address');
    } else {
        console.log('ucast other ip address');
        serialPort.write(message, (err) => {
            if (err) {
                console.error('Serial port write error:', err);
            }
        });
    }
});


bcastSocket.on('message', (message, rinfo) => {
    console.log('bcastsocket received:', rinfo.address, rinfo.port, 'message:', message.toString('hex'));
    if (rinfo.address == MY_IP_ADDRESS) {
        console.log('bcast my ip address');
    } else {
        console.log('bcast other ip address');
        serialPort.write(message, (err) => {
            if (err) {
                console.error('Serial port write error:', err);
            }
        });
    }
});

let buffer_array = Buffer.alloc(0);
let temp_array = Buffer.alloc(0);
let data_length = null;
let UXV_data = null;
let id = null;
let dl = null;
let tdl = null;

serialPort.on('data', (data) => {
    console.log('-------------------------------------');
    console.log('serial received:' + data.toString('hex'));
    // size = data.length
    // console.log('size:', size);
    buffer_array = Buffer.concat([buffer_array, data]);
    console.log('buffer', buffer_array);
    //---------------------------------------------------
    // k -> data_length    dl -> UXV_data

    while (true) {
        let count = 0;
        if ((buffer_array.length) >= buffer_array[2] + 12) {
            if (buffer_array[0] == 0xaa && buffer_array[1] == 0x55) {
                data_length = buffer_array[2] + 12;
                // console.log('k value', k);

                UXV_data = buffer_array.slice(0, data_length);
                console.log('parsing data', UXV_data.toString('hex'));
                buffer_array = buffer_array.slice(data_length, UXV_data.length);


                if (UXV_data.length > 0) {
                    console.log('header1', UXV_data[0].toString(16), 'header2', UXV_data[1].toString(16), 'payload length', UXV_data[2], 'packet sequence', UXV_data[3], 'source ID', UXV_data[4], 'port', UXV_data[5], 'destination ID', UXV_data[6],
                        'port', UXV_data[7], 'packet priority', UXV_data[8], 'message Id', UXV_data[9]);

                    id = UXV_data[6];
                    if (id == 255) {
                        ip = id_ip_dic[id.toString()];
                        console.log('id, ip', id, ip);
                        //send_broadcast();
                        bcastSocket.send(UXV_data, 0, UXV_data.length, BCAST_PORT, BCAST_HOST, (err) => {
                            if (err) {
                                console.error('BCAST send error:', err);
                            }
                        });
                    } else {
                        ip = id_ip_dic[id.toString()];
                        console.log('id, ip', id, ip);
                        //send_unicast();
                        udpSocket.send(UXV_data, 0, UXV_data.length, UCAST_PORT, ip, (err) => {
                            if (err) {
                                console.error('UCAST send error:', err);
                            }
                        });
                    }
                }
            }
        } else {
            count = 0;
            break;
        }
    }
});

udpSocket.on('listening', () => {
    console.log('UCAST socket listening on', UCAST_HOST + ':' + UCAST_PORT);
});

bcastSocket.on('listening', () => {
    bcastSocket.setBroadcast(true);
    console.log('BCAST socket listening on', BCAST_HOST + ':' + BCAST_PORT);
});

serialPort.on('open', () => {
    console.log('Serial port connected on', SERIAL_PORT);
});

udpSocket.bind(UCAST_PORT);
bcastSocket.bind(BCAST_PORT);
