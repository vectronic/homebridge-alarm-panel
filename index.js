'use strict';

const inherits = require('util').inherits;
const express = require('express')();
const storage = require('node-persist');

const WEB_UI_CONTEXT = 'ALARM_PANEL_WEB_UI';
const JSON_CONTENT = {'Content-Type': 'application/json'};

const hap = require("hap-nodejs");

const Service = hap.Service;
const Characteristic = hap.Characteristic;

module.exports = function(homebridge) {

    homebridge.registerPlatform("homebridge-alarm-panel", "AlarmPanel", AlarmPanelPlatform);
    homebridge.registerAccessory("homebridge-alarm-panel", "AlarmPanelAccessory", AlarmPanelAccessory);
};

/**
 * Characteristic "ArmedMode"
 */

Characteristic.ArmedMode = function() {
    Characteristic.call(this, 'Armed Mode', '01234567-0000-1000-8000-0026BB765291');
    this.setProps({
        format: Characteristic.Formats.UINT8,
        maxValue: 1,
        minValue: 0,
        validValues: [0, 1],
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};

inherits(Characteristic.AlarmMode, Characteristic);

Characteristic.ArmedMode.UUID = '01234567-0000-1000-8000-0026BB765291';

Characteristic.ArmedMode.HOME = 0;
Characteristic.ArmedMode.AWAY = 1;


function getArmedModeFromString(armedModeString) {

    if (armedModeString === 'AWAY') {
        return Characteristic.ArmedMode.AWAY;
    }
    return Characteristic.ArmedMode.HOME;
}


function getStringFromArmedMode(armedMode) {

    if (armedMode === Characteristic.ArmedMode.AWAY) {
        return 'AWAY';
    }
    return 'HOME';
}


/**
 * Characteristic "AlarmState"
 */

Characteristic.AlarmState = function() {
    Characteristic.call(this, 'Alarm State', '81234567-0000-1000-8000-0026BB7652988');
    this.setProps({
        format: Characteristic.Formats.UINT8,
        maxValue: 4,
        minValue: 0,
        validValues: [0, 1, 2, 3, 4],
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
};

inherits(Characteristic.AlarmState, Characteristic);

Characteristic.AlarmState.UUID = '81234567-0000-1000-8000-0026BB765298';

Characteristic.AlarmState.OFF = 0;
Characteristic.AlarmState.ARMING = 1;
Characteristic.AlarmState.ARMED = 2;
Characteristic.AlarmState.TRIPPED = 3;
Characteristic.AlarmState.ALARMING = 4;


function getStringFromAlarmState(alarmState) {

    switch (alarmState) {
        case Characteristic.AlarmState.ALARMING:
            return 'ALARMING';
        case Characteristic.AlarmState.TRIPPED:
            return 'TRIPPED';
        case Characteristic.AlarmState.ARMED:
            return 'ARMED';
        case Characteristic.AlarmState.ARMING:
            return 'ARMING';
        default:
            return 'OFF';
    }
}


/**
 * Service "AlarmPanel"
 */

Service.AlarmPanel = function() {
    Service.call(this, 'Alarm Panel', '31234567-0000-1000-8000-0026BB765293');

    this.addCharacteristic(Characteristic.ArmedMode);
    this.addCharacteristic(Characteristic.AlarmState);
};

inherits(Service.AlarmPanel, Service);

Service.AlarmPanel.UUID = '31234567-0000-1000-8000-0026BB765293';


/**
 * Platform "AlarmPanel"
 */

function AlarmPanelPlatform(log, config) {

    this.log = log;
    this.webUiPort = config["web_ui_port"] || 8888;
    this.storage = storage;
    this.storage.initSync();
}


AlarmPanelPlatform.prototype.accessories = function(callback) {

    this.accessory = new AlarmPanelAccessory(this.log, this.storage);

    callback([this.accessory]);

    const app = express();

    app.use(express.bodyParser());
    app.use(express.static('html'));

    const that = this;

    app.get('/api/armedMode', function(request, response) {

        let currentMode = that.storage.getItemSync('ArmedMode');
        if (currentMode === undefined) {
            currentMode = Characteristic.ArmedMode.HOME;
        }
        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify({
            alarmMode: getStringFromArmedMode(currentMode)
        }));
    });

    app.post('/api/armedMode', function(request, response) {

        let currentMode = that.storage.getItemSync('ArmedMode');
        if (currentMode === undefined) {
            currentMode = Characteristic.ArmedMode.HOME;
        }

        const newMode = getArmedModeFromString(JSON.parse(request.body).armedMode);

        that.storage.setItemSync(ArmedMode, newMode);

        if (currentMode !== newMode) {
            that.accessory.changeHandlerArmedMode(newMode);
            currentMode = newMode;
        }

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify({
            alarmMode: getStringFromArmedMode(currentMode)
        }));
    });

    app.get('/api/alarmState', function(request, response) {

        let currentState = that.storage.getItemSync('AlarmState');
        if (currentState === undefined) {
            currentState = Characteristic.AlarmState.OFF;
        }
        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify({
            alarmState: getStringFromAlarmState(currentState)
        }));
    });

    app.listen(this.webUiPort);

    this.log("Started server for alarm-panel on port '%s'.", this.webUiPort);
};


/**
 * Accessory "AlarmPanel"
 */

function AlarmPanelAccessory(log, storage) {

    this.log = log;
    this.storage = storage;

    this.service = new Service.AlarmPanel();

    this.changeHandlerArmedMode = (function(newState) {
        this.log("Change HomeKit state for ArmedMode to '%s'.", newState);
        this.service.getCharacteristic(Characteristic.ArmedMode)
            .updateValue(newState, undefined, WEB_UI_CONTEXT);
    }).bind(this);

    this.service.getCharacteristic(Characteristic.ArmedMode)
        .on('get', this.getArmedMode.bind(this))
        .on('set', this.setArmedMode.bind(this));

    this.service.getCharacteristic(Characteristic.AlarmState)
        .on('get', this.getAlarmState.bind(this))
        .on('set', this.setAlarmState.bind(this));
}


AlarmPanelAccessory.prototype.getArmedMode = function(callback) {

    this.log('Getting current value of ArmedMode');

    let mode = this.storage.getItemSync('ArmedMode');
    if (mode === undefined) {
        mode = Characteristic.ArmedMode.HOME;
    }
    callback(null, mode);
};


AlarmPanelAccessory.prototype.setArmedMode = function(mode, callback) {

    this.log('Setting current value for ArmedMode');

    this.storage.setItemSync('ArmedMode', mode);

    callback(null);
};


AlarmPanelAccessory.prototype.getAlarmState = function(callback) {

    this.log('Getting current value of AlarmState');

    let state = this.storage.getItemSync('AlarmState');
    if (state === undefined) {
        state = Characteristic.AlarmState.OFF;
    }
    callback(null, state);
};


AlarmPanelAccessory.prototype.setAlarmState = function(state, callback) {

    this.log('Setting current value for AlarmState');

    this.storage.setItemSync('AlarmState', state);

    callback(null);
};


AlarmPanelAccessory.prototype.getServices = function() {
    return [ this.service ];
};
