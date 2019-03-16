'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const serveStatic = require('serve-static');

const WEB_UI_CONTEXT = 'ALARM_PANEL_WEB_UI';
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
        that.log(`newAwayState: ${newAwayState}`);

        if (currentAwayState !== newAwayState) {
            that.alarmPanelAccessory.changeHandlerAway(newAwayState);
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

    this.name = config.name;

    this.armDelay = config.arm_delay;
    this.alarmDelay = config.alarm_delay;

    this.away = false;
    this.armed = false;
    this.tripped = false;
    this.alarming = false;

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

    this.changeHandlerAway= (function(newState) {
        this.log("Change HomeKit state for Away to '%s'.", newState);
        this.awayService.getCharacteristic(Characteristic.On)
            .updateValue(newState, undefined, WEB_UI_CONTEXT);
    }).bind(this);
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


AlarmPanelAccessory.prototype.getAway = function(callback) {
    this.log(`Getting current value of Away: ${this.away}`);
    callback(null, this.away);
};


AlarmPanelAccessory.prototype.setAway = function(away, callback) {
    this.log(`Setting current value of Away to: ${away}`);
    this.away = away;
    callback(null);
};


AlarmPanelAccessory.prototype.getArmed = function(callback) {
    this.log(`Getting current value of Armed: ${this.armed}`);
    callback(null, this.armed);
};


AlarmPanelAccessory.prototype.setArmed = function(armed, callback) {
    this.log(`Setting current value of Armed to: ${armed}`);
    this.armed = armed;
    callback(null);
};


AlarmPanelAccessory.prototype.getTripped = function(callback) {
    this.log(`Getting current value of Tripped: ${this.tripped}`);
    callback(null, this.tripped);
};


AlarmPanelAccessory.prototype.setTripped = function(tripped, callback) {
    this.log(`Setting current value of Tripped to: ${tripped}`);
    this.tripped = tripped;
    callback(null);
};


AlarmPanelAccessory.prototype.getAlarming = function(callback) {
    this.log(`Getting current value of Alarming: ${this.alarming}`);
    callback(null, this.alarming);
};


AlarmPanelAccessory.prototype.setAlarming = function(alarming, callback) {
    this.log(`Setting current value of Alarming to: ${alarming}`);
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
