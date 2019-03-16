'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const serveStatic = require('serve-static');

const WEB_UI_CONTEXT = 'ALARM_PANEL_WEB_UI';
const TIMEOUT_CONTEXT = 'ALARM_PANEL_TIMEOUT';
const LOGIC_CONTEXT = 'ALARM_PANEL_LOGIC';
const JSON_CONTENT = {'Content-Type': 'application/json'};

let Service;
let Characteristic;

/**
 * Platform "AlarmPanel"
 */

function AlarmPanelPlatform(log, config) {

    this.log = log;
    this.config = config;

    this.webUiPort = config["web_ui_port"] || 8888;
}


AlarmPanelPlatform.prototype.accessories = function(callback) {

    this.alarmPanelAccessory = new AlarmPanelAccessory(this.log, this.config);

    callback( [ this.alarmPanelAccessory ] );

    const app = express();

    app.use(serveStatic(path.join(__dirname, 'html')));

    const jsonParser = bodyParser.json();

    const that = this;

    app.get('/api/state', function(request, response) {

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify(that.alarmPanelAccessory.getState()));
    });

    app.post('/api/state', jsonParser, function(request, response) {

        let currentAwayState = that.alarmPanelAccessory.away;

        const newAwayState = request.body.away;
        that.log(`currentAwayState: ${currentAwayState} => newAwayState: ${newAwayState}`);

        if (currentAwayState !== newAwayState) {
            // that.alarmPanelAccessory.away = newAwayState;
            that.alarmPanelAccessory.awayService
                .getCharacteristic(Characteristic.On)
                .setValue(newAwayState, undefined, WEB_UI_CONTEXT);
        }

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify(that.alarmPanelAccessory.getState()));
    });

    app.listen(this.webUiPort);

    this.log("Started server for alarm-panel on port '%s'.", this.webUiPort);
};


/**
 * Accessory "AlarmPanel"
 */

function AlarmPanelAccessory(log, config) {

    this.log = log;
    this.config = config;

    this.name = config.name || 'Alarm Panel';

    this.armDelay = config.arm_delay || 60;
    this.alarmDelay = config.alarm_delay || 60;

    this.away = false;
    this.armed = false;
    this.tripped = false;
    this.alarming = false;

    this.armedTimeout = null;
    this.alarmingTimeout = null;

    this.awayService = new Service.Switch('Away', 'away');
    this.awayService.getCharacteristic(Characteristic.On)
        .on('get', this.getAway.bind(this))
        .on('set', this.setAway.bind(this));

    this.armedService = new Service.Switch('Armed', 'armed');
    this.armedService.getCharacteristic(Characteristic.On)
        .on('get', this.getArmed.bind(this))
        .on('set', this.setArmed.bind(this));

    this.trippedService = new Service.Switch('Tripped', 'tripped');
    this.trippedService.getCharacteristic(Characteristic.On)
        .on('get', this.getTripped.bind(this))
        .on('set', this.setTripped.bind(this));

    this.alarmingService = new Service.Switch('Alarming', 'alarming');
    this.alarmingService.getCharacteristic(Characteristic.On)
        .on('get', this.getAlarming.bind(this))
        .on('set', this.setAlarming.bind(this));

    this.accessoryInformationService = new Service.AccessoryInformation();
    this.accessoryInformationService.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.accessoryInformationService.setCharacteristic(Characteristic.Model, "Alarm Panel");
}


AlarmPanelAccessory.prototype.getState = function() {

    const state = {
        away: this.away,
        armed: this.armed,
        tripped: this.tripped,
        alarming: this.alarming
    };

    this.log(`Getting current accessory state: ${JSON.stringify(state)}`);
    return state;
};


AlarmPanelAccessory.prototype.getAway = function(callback, context) {
    this.log(`Getting current value of Away: ${this.away} via context: ${context}`);
    callback(null, this.away);
};


AlarmPanelAccessory.prototype.setAway = function(away, callback, context) {
    this.log(`Setting current value of Away to: ${away} via context: ${context}`);
    this.away = away;

    // Clear timeout regardless
    if (this.armedTimeout) {
        clearTimeout(this.armedTimeout);
        this.log('Armed timeout cleared...');
    }

    if (away) {

        const that = this;
        // Set timeout to transition to armed
        this.armedTimeout = setTimeout(() => {
            that.log('Armed timeout expired!');

            // prevent race condition
            if (!that.away) {
                that.log('Ignoring Armed Timeout as Away is false!');
            }
            else {
                that.armed = true;
                that.armedService
                    .getCharacteristic(Characteristic.On)
                    .setValue(true, undefined, TIMEOUT_CONTEXT);
            }
        }, this.armDelay * 1000);
        this.armedTimeout.unref();
        this.log('Armed timeout set...');
    }
    else {

        // Clear any alarming timeouts
        if (this.alarmingTimeout) {
            clearTimeout(this.alarmingTimeout);
        }

        // Clear armed, triggered and alarming states
        this.armed = false;
        this.armedService
            .getCharacteristic(Characteristic.On)
            .setValue(false, undefined, LOGIC_CONTEXT);
        this.tripped = true;
        this.trippedService
            .getCharacteristic(Characteristic.On)
            .setValue(false, undefined, LOGIC_CONTEXT);
        this.alarming = true;
        this.alarmingService
            .getCharacteristic(Characteristic.On)
            .setValue(false, undefined, LOGIC_CONTEXT);
    }
    callback(null);
};


AlarmPanelAccessory.prototype.getArmed = function(callback, context) {
    this.log(`Getting current value of Armed: ${this.armed} via context: ${context}`);
    callback(null, this.armed);
};


AlarmPanelAccessory.prototype.setArmed = function(armed, callback, context) {
    this.log(`Setting current value of Armed to: ${armed} via context: ${context}`);
    this.armed = armed;
    callback(null);
};


AlarmPanelAccessory.prototype.getTripped = function(callback, context) {
    this.log(`Getting current value of Tripped: ${this.tripped} via context: ${context}`);
    callback(null, this.tripped);
};


AlarmPanelAccessory.prototype.setTripped = function(tripped, callback, context) {
    this.log(`Requested to set current value of Tripped to: ${tripped} via context: ${context}`);

    if (tripped && !this.armed) {
        this.log('State is not armed, ignoring request to set tripped to true...');
        callback('invalid state');
        return;
    }
    this.tripped = tripped;

    // Clear timeout regardless
    if (this.alarmingTimeout) {
        clearTimeout(this.alarmingTimeout);
        this.log('Alarming timeout cleared...');
    }

    if (tripped) {

        const that = this;
        // Set timeout to transition to alarming
        this.alarmingTimeout = setTimeout(() => {
            that.log('Alarming timeout expired!');

            // prevent race condition
            if (!that.away) {
                that.log('Ignoring Alarming Timeout as Away is false!');
            }
            else {
                that.alarming = true;
                that.alarmingService
                    .getCharacteristic(Characteristic.On)
                    .setValue(true, undefined, TIMEOUT_CONTEXT);
            }
        }, this.alarmDelay * 1000);
        this.alarmingTimeout.unref();
        this.log('Alarming timeout set...');
    }
    callback(null);
};


AlarmPanelAccessory.prototype.getAlarming = function(callback, context) {
    this.log(`Getting current value of Alarming: ${this.alarming} via context: ${context}`);
    callback(null, this.alarming);
};


AlarmPanelAccessory.prototype.setAlarming = function(alarming, callback, context) {
    this.log(`Setting current value of Alarming to: ${alarming} via context: ${context}`);

    if (context !== LOGIC_CONTEXT && context !== LOGIC_CONTEXT) {
        this.log(`Invalid context for setting alarming state, ignoring request to set alarming to ${alarming}...`);
        callback('invalid context');
        return;
    }

    this.alarming = alarming;
    callback(null);
};


AlarmPanelAccessory.prototype.getServices = function() {

    this.log('getServices');

    return [
        this.accessoryInformationService,
        this.awayService,
        this.armedService,
        this.trippedService,
        this.alarmingService
    ];
};


module.exports = function(homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerPlatform("homebridge-alarm-panel", "AlarmPanel", AlarmPanelPlatform);
};
