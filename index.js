'use strict';

const express = require('express')();

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

    app.use(express.bodyParser());
    app.use(express.static('html'));

    const that = this;

    app.get('/api/state', function(request, response) {

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify({
            // away: that.alarmPanelAccessory.away,
            // armed: that.alarmPanelAccessory.armed,
            // tripped: that.alarmPanelAccessory.tripped,
            // alarming: that.alarmPanelAccessory.alarming
        }));
    });

    app.post('/api/state', function(request, response) {

        // let currentAwayState = that.alarmPanelAccessory.away;
        //
        // const newAwayState = JSON.parse(request.body).away;
        //
        // if (currentAwayState !== newAwayState) {
        //     that.alarmPanelAccessory.changeHandlerAway(newAwayState);
        // }

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify({
            // away: that.alarmPanelAccessory.away,
            // armed: that.alarmPanelAccessory.armed,
            // tripped: that.alarmPanelAccessory.tripped,
            // alarming: that.alarmPanelAccessory.alarming
        }));
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

    this.accessoryInformationService
        .setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.accessoryInformationService
        .setCharacteristic(Characteristic.Model, "Alarm Panel");

    this.awayService = new Service.Switch('Away', 'away');

    // this.awayService.getCharacteristic(Characteristic.On)
    //     .on('set', this.setAwayOn.bind(this));
    // this.awayService.setCharacteristic(Characteristic.On, this.away);

    this.armedService = new Service.Switch('Armed', 'armed');
    this.trippedService = new Service.Switch('Tripped', 'tripped');
    this.alarmingService = new Service.Switch('Alarming', 'alarming');

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

//
// AlarmPanelAccessory.prototype.getArmedMode = function(callback) {
//
//     this.log(`Getting current value of ArmedMode: ${this.platform.armedMode}`);
//
//     callback(null, this.platform.armedMode);
// };
//
//
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

    // /**
    //  * Characteristic "ArmedMode"
    //  */
    //
    // Characteristic.ArmedMode = function() {
    //     Characteristic.call(this, 'Armed Mode', '01234567-0000-1000-8000-0026BB765291');
    //     this.setProps({
    //         format: Characteristic.Formats.UINT8,
    //         maxValue: 1,
    //         minValue: 0,
    //         validValues: [0, 1],
    //         perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    //     });
    //     this.value = this.getDefaultValue();
    // };
    //
    // inherits(Characteristic.ArmedMode, Characteristic);
    //
    // Characteristic.ArmedMode.UUID = '01234567-0000-1000-8000-0026BB765291';
    //
    // Characteristic.ArmedMode.HOME = 0;
    // Characteristic.ArmedMode.AWAY = 1;
    //
    //
    // Characteristic.ArmedMode.getArmedModeFromString = function(armedModeString) {
    //
    //     if (armedModeString === 'AWAY') {
    //         return Characteristic.ArmedMode.AWAY;
    //     }
    //     return Characteristic.ArmedMode.HOME;
    // };
    //
    //
    // Characteristic.ArmedMode.getStringFromArmedMode = function(armedMode) {
    //
    //     if (armedMode === Characteristic.ArmedMode.AWAY) {
    //         return 'AWAY';
    //     }
    //     return 'HOME';
    // };
    //
    //
    // /**
    //  * Characteristic "AlarmState"
    //  */
    //
    // Characteristic.AlarmState = function() {
    //     Characteristic.call(this, 'Alarm State', '81234567-0000-1000-8000-0026BB7652988');
    //     this.setProps({
    //         format: Characteristic.Formats.UINT8,
    //         maxValue: 4,
    //         minValue: 0,
    //         validValues: [0, 1, 2, 3, 4],
    //         perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    //     });
    //     this.value = this.getDefaultValue();
    // };
    //
    // inherits(Characteristic.AlarmState, Characteristic);
    //
    // Characteristic.AlarmState.UUID = '81234567-0000-1000-8000-0026BB765298';
    //
    // Characteristic.AlarmState.OFF = 0;
    // Characteristic.AlarmState.ARMING = 1;
    // Characteristic.AlarmState.ARMED = 2;
    // Characteristic.AlarmState.TRIPPED = 3;
    // Characteristic.AlarmState.ALARMING = 4;
    //
    //
    // Characteristic.AlarmState.getStringFromAlarmState = function(alarmState) {
    //
    //     switch (alarmState) {
    //         case Characteristic.AlarmState.ALARMING:
    //             return 'ALARMING';
    //         case Characteristic.AlarmState.TRIPPED:
    //             return 'TRIPPED';
    //         case Characteristic.AlarmState.ARMED:
    //             return 'ARMED';
    //         case Characteristic.AlarmState.ARMING:
    //             return 'ARMING';
    //         default:
    //             return 'OFF';
    //     }
    // };
    //
    //
    // /**
    //  * Service "AlarmPanel"
    //  */
    //
    // Service.AlarmPanel = function(displayName, subtype) {
    //     Service.call(this, displayName, '31234567-0000-1000-8000-0026BB765293', subtype);
    //
    //
    //     this.addCharacteristic(Characteristic.ArmedMode);
    //     this.addCharacteristic(Characteristic.AlarmState);
    // };
    //
    // inherits(Service.AlarmPanel, Service);
    //
    // Service.AlarmPanel.UUID = '31234567-0000-1000-8000-0026BB765293';

    homebridge.registerPlatform("homebridge-alarm-panel", "AlarmPanel", AlarmPanelPlatform);
    // homebridge.registerAccessory("homebridge-alarm-panel", "AlarmPanelAccessory", AlarmPanelAccessory);
};
