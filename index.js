"use strict";

var inherits = require('util').inherits;
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;





  /**
   * Characteristic "Time Remaining"
   */

  Characteristic.TimeRemaining = function() {
    Characteristic.call(this, 'Time Remaining', '1000006D-0000-1000-8000-0026BB765291');
    this.setProps({
      format: Characteristic.Formats.UINT64,
      unit: Characteristic.Units.SECONDS,
      maxValue: 3600,
      minValue: 0,
      minStep: 5,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  inherits(Characteristic.TimeRemaining, Characteristic);

  Characteristic.TimeRemaining.UUID = '1000006D-0000-1000-8000-0026BB765291';



  homebridge.registerAccessory("homebridge-occupancy-timer", "OccupancyTimer", OccupancyTimer);
};



/**
 * This accessory publishes an Occupancy Sensor as well as 1 or more slave
 * Switches to control the status of the sensor. If any of the slaves are on
 * then this sensor registers as "Occupancy Detected" ("Occupied). When all
 * slaves are turned off this will remain "Occupied" for as long as the
 * specified delay.
 *
 * Config:
 *
 * name: The name of this Occupancy Sensor and it's slave switches. If there are
 *      more than one slaves they will become "name 1", "name 2", etc.
 * slaveCount (optional): Will create 1 slave Switch with the same name as the
 *      Occupancy Sensor by default. Change this if you need more than 1 Switch
 *      to control the sensor.
 * delay: If set to less than 1 there will be no delay when all Switches are
 *      turned to off. Specify a number in seconds and the sensor will wait
 *      that long after all switches have been turned off to become
 *      "Un-occupied". If any slave Switch is turned on the counter will clear
 *      and start over once all Switches are off again.
 *
 *
 * What can I do with this plugin?
 * @todo: Addd use case and instructions here.
 */
class OccupancyTimer {
  constructor(log, config) {
    this.log = log;
    this.name = config.name || "OccupancyTimer";
    this.slaveCount = Math.max(1, (config.slaveCount || 1));
    this.delay = Math.min(3600, Math.max(0, parseInt(config.delay, 10) || 0));


    this._timer = null;
    this._timer_started = null;
    this._interval = null;
    this._interval_last_value = 0;
    this._last_occupied_state = false;

    this.switchServices = [];
    this.occupancyService = new Service.OccupancySensor(this.name);
    this.occupancyService.addCharacteristic(Characteristic.TimeRemaining);
    this.occupancyService.setCharacteristic(Characteristic.TimeRemaining, 0);




    /* Make the slave Switches */
    if (1 === this.slaveCount) {
      this.log('Making a single slave switch');
      this.switchServices.push(this._createSwitch());
    } else {
      this.log('Making ' + this.slaveCount + ' salve switches');
      for (let i = 0, c = this.slaveCount; i < c; i += 1) {
        this.switchServices.push(this._createSwitch(i + 1));
      }
    }
  }

  /**
   * Starts the countdown timer.
   */
  start() {
    this.stop();
    this._timer_started = (new Date()).getTime();
    this.log('Timer started');
    if (this.delay) {
      this._timer = setTimeout(this.setOccupancyNotDetected.bind(this), (this.delay * 1000));
      this._interval = setInterval(() => {
        var elapsed = ((new Date()).getTime() - this._timer_started) / 1000,
            newValue = Math.round(this.delay - elapsed);

        if (newValue !== this._interval_last_value) {
          this.occupancyService.setCharacteristic(Characteristic.TimeRemaining, newValue);
          this._interval_last_value = newValue;
        }
      }, 250);
    } else {
      /* occupancy no longer detected */
      this.setOccupancyNotDetected();
    }
  };

  /**
   * Stops teh countdown timer
   */
  stop() {
    if (this._timer) {
      this.log('Timer stopped');
      clearTimeout(this._timer);
      clearInterval(this._interval);
      this._timer = null;
      this._timer_started = null;
      this._interval = null;
    }
  };


  setOccupancyDetected() {
    this._last_occupied_state = true;
    this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
    if (this.delay) {
      this.occupancyService.setCharacteristic(Characteristic.TimeRemaining, this.delay);
    }
  }

  setOccupancyNotDetected() {
    this._last_occupied_state = false;
    this.stop();
    this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
    if (this.delay) {
      this.occupancyService.setCharacteristic(Characteristic.TimeRemaining, 0);
    }
  }

  /**
   * Checks all the slave Switches to see if any of them are on. If so this
   * Occupancy Sensor will remain "Occupied". This is used as a callback when
   * the "On" state changes on any of the slave Switches.
   */
  checkOccupancy() {
    var occupied = 0,
        remaining = this.slaveCount,

        /* callback for when all the switches values have been returend */
        return_occupancy = function(occupied) {
          //if (occupied) {
          //  this.setOccupancyDetected();
          //} else {
          //  this.setOccupancyNotDetected();
          //}

          this.log('Last occupied state: ' + this._last_occupied_state);
          if (occupied) {
            if (this._last_occupied_state === !!occupied) {
              this.stop();
            } else {
              this.setOccupancyDetected();
            }
          } else if (null === this._timer) {
            this.start();
          }

          // @todo: Set a custom property for how many switches we're waiting for
          this.log('checkOccupancy: ' + occupied);
        }.bind(this),

        /*
          callback when we check a switches value. keeps track of the switches
          returned value and decides when to finish the function
        */
        set_value = function(value) {
          remaining -= 1;
          if (value) {
            occupied += 1;
          }

          if (!remaining) {
            return_occupancy(occupied);
          }
        }.bind(this);


    /* look at all the slave switches "on" characterisitc and return to callback */
    for (let i = 0; i < this.slaveCount; i += 1) {
      this.switchServices[i]
          .getCharacteristic(Characteristic.On)
          .getValue(function(err, value) {
            if (!err) {
              set_value(value);
            }
          });
    }
  }

  /**
   * Homebridge function to return all the Services associated with this
   * Accessory.
   *
   * @returns {*[]}
   */
  getServices() {
    var informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'github.com/archanglmr')
        .setCharacteristic(Characteristic.Model, '0.1')
        .setCharacteristic(Characteristic.SerialNumber, '20171019');


    return [this.occupancyService, informationService, ...this.switchServices]
  }

  /**
   * Internal helper function to create a new "Switch" that is ties to the
   * status of this Occupancy Snesor.
   *
   * @param name
   * @returns {Service.Switch|*}
   * @private
   */
  _createSwitch(name) {
    var displayName = (name || '').toString(),
        sw;

    if (displayName.length) {
      displayName = this.name + ' ' + displayName;
    } else {
      displayName = this.name;
    }

    this.log('Create Switch: ' + displayName);
    sw = new Service.Switch(displayName, name);
    sw.setCharacteristic(Characteristic.On, false);
    sw.getCharacteristic(Characteristic.On).on('change', this.checkOccupancy.bind(this));

    return sw;
  }
}

