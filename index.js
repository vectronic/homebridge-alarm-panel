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

        // let currentAwayState = that.alarmPanelAccessory.away;

        const newAwayState = request.body.away;
        this.log(`newAwayState: ${newAwayState}`);

        // if (currentAwayState !== newAwayState) {
        //     that.alarmPanelAccessory.changeHandlerAway(newAwayState);
        // }

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

    // this.away = false;
    // this.armed = false;
    // this.tripped = false;
    // this.alarming = false;

    this.accessoryInformationService = new Service.AccessoryInformation();
    this.accessoryInformationService.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.accessoryInformationService.setCharacteristic(Characteristic.Model, "Alarm Panel");

    this.awayService = new Service.Switch('Away', 'away');
    // this.awayService.getCharacteristic(Characteristic.On)
    //     .on('set', this.setAwayOn.bind(this));
    this.awayService.setCharacteristic(Characteristic.On, false);

    this.armedService = new Service.Switch('Armed', 'armed');
    this.armedService.setCharacteristic(Characteristic.On, false);

    this.trippedService = new Service.Switch('Tripped', 'tripped');
    this.trippedService.setCharacteristic(Characteristic.On, false);

    this.alarmingService = new Service.Switch('Alarming', 'alarming');
    this.alarmingService.setCharacteristic(Characteristic.On, false);

    // this.changeHandlerArmedMode = (function(newState) {
    //     this.log("Change HomeKit state for ArmedMode to '%s'.", newState);
    //     this.alarmPanelService.getCharacteristic(Characteristic.ArmedMode)
    //         .updateValue(newState, undefined, WEB_UI_CONTEXT);
    // }).bind(this);

    // this.alarmPanelService.getCharacteristic(Characteristic.ArmedMode)
    //     .on('get', this.getArmedMode.bind(this))
    //     .on('set', this.setArmedMode.bind(this));
    //
    // this.alarmPanelService.getCharacteristic(Characteristic.AlarmState)
    //     .on('get', this.getAlarmState.bind(this))
    //     .on('set', this.setAlarmState.bind(this));
}


AlarmPanelAccessory.prototype.getState = function() {

    this.log('Getting current accessory state');

    return {
        away: this.awayService.getCharacteristic(Characteristic.On).getValue(),
        armed: this.armedService.getCharacteristic(Characteristic.On).getValue(),
        tripped: this.trippedService.getCharacteristic(Characteristic.On).getValue(),
        alarming: this.alarmingService.getCharacteristic(Characteristic.On).getValue()
    };
};


// AlarmPanelAccessory.prototype.setArmedMode = function(mode, callback) {
//
//     this.log(`Setting current value for ArmedMode to: ${mode}`);
//
//     this.platform.armedMode = mode;
//
//     callback(null);
// };
//

// AlarmPanelAccessory.prototype.getAlarmState = function(callback) {
//
//     this.log(`Getting current value of AlarmState: ${this.platform.alarmState}`);
//
//     callback(null, this.platform.alarmState);
// };
//
//
// AlarmPanelAccessory.prototype.setAlarmState = function(state, callback) {
//
//     this.log(`Setting current value for AlarmState to: ${state}`);
//
//     this.platform.alarmState = state;
//
//     callback(null);
// };


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
