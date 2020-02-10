# "Occupancy Delay" Plugin


## How to install

 ```sudo npm install -g homebridge-occupancy-delay```
 
## Example config.json:

 ```
    "accessories": [
        {
          "accessory": "OccupancyDelay",
          "name": "OccupancyDelay",
          "delay": 5,
          "slaveCount": 1,
          "protected": false
        }   
    ]
```

Note: "delay" is in seconds. If "protected" is set to true, the slave switches will be
created using a custom boolean characteristic that can't be controlled through Siri
(or the current Home app), but can be controlled through third party apps such as Eve:
they can thus be protected from being controlled accidentally through a misunderstood Siri
command.

## What problem will this solve?

In iOS11 you are now able to turn off an automation after a certain number of minutes. This is good for specifically for blindly turning off a scene after a fixed amount of time. The problem is there is no way to interrupt or reset the internal timer like some basic automation require.

### Take this setup with the stock rules and no extra sensors:
 - You have a motion sensor in your laundry room
 - When motion is detected, power on the light, set the brightness to 50%
 - When motion is not detected, power on the light, turn off after 2 minutes
 
You need to power "on" the lights in the last step so that homekit has a target to turn off. To create this automation requires you to set up everything in the home app, make tweaks in a 3rd party app such as Eve.

Lets run some scenarios with this setup.

### Scenario 1:
 - You enter the room, the motion sensor becomes active, the lights turn on to 50%.
 - You leave the room, the motion sensor becomes inactive, the lights power on and the "turn off" timer starts.
 - 2 minutes later the lights turn off.

Great right? Lets try a few more real world examples.


### Scenario 2:
 - You enter the room, the motion sensor becomes active, the lights turn on to 50%.
 - You leave the room, on the way out you flip the light switch setting the lights to "off".
 - The motion sensor becomes inactive, the lights power on and the "turn off" timer starts.
 - 2 minutes later the lights turn off.

Uh-oh, you didn't want the lights to power back on when you had specifically turned them off at the switch.


### Scenario 3:
 - You enter the room, the motion sensor becomes active, the lights turn on to 50%.
 - You briefly exit the room (or stand still for to long), the motion sensor becomes inactive, the lights power on and the "turn off" timer starts.
 - You re-enter the room (or move), the lights power on and turn to 50%.
 - You work in the room for a bit, 2 minutes later the lights turn off, the motion sensor is still active.
 
That's no good, now you're in the dark. Moving around doesn't help you here because the motion sensor is already still active.
What are you supposed to do? Leave the room long enough for the motion sensor to read inactive, then move around the room to activate it?

There are several more scenario like this that will fail. As you can see the "turn off after" feature is extremely literal and to my knowledge there is no way to overwrite it's internal timer.


## How does this plugin solve the problem?

### The desired effect is:
 - When I walk into the room, turn the light on to 50%
 - When there has been no motion for 2 CONSECUTIVE minutes turn off the light


Sounds simple enough. What this plugin does is crates one or more "dummy" switches and an occupancy sensor that reads their state.

 - The occupancy sensor becomes "occupied" when any of the switches turn to "on".
 - The occupancy sensor has an internal "turn off" timer that starts when all the linked switches turn to "off".
 - Anytime any linked switch is on, the internal "turn off" timer is clear.
 - Once the "turn off" timer expires the occupancy sensor becomes "unoccupied".


### Wiring it up (automation rules):
 - When occupancy is detected, turn light on, set brightness to 50%
 - When occupancy is not-detected, turn light off.
 - When motion is detected, turn "dummy" switch "on".
 - When motion is not-detected, turn "dummy" switch "off".
 - (If you want you can tie more sensors to more "dummy" switches and the occupancy sensor will wait for all the switches to be "off" before starting the "turn off" timer).
 
Now the light is tied to the smarter occupancy sensor, not an erratic motion sensor. The "dummy" switch(es) directly reflects the motion sensor(s). This allows the software "dummy" switch to do it's magic with the occupancy sensor.


Lets play scenarios again with the new setup to see how it works.

### Scenario 1:
 - You enter the room, the motion sensor becomes active, triggering the dummy switch turns "on", occupancy sensor registers "occupied", triggering the lights turn on to 50%.
 - You leave the room, the motion sensor becomes inactive, dummy switch turns "off", occupancy sensor still reads "occupied" but starts internal timer.
 - 2 minutes later the occupancy sensor's "turn off" timer expires and the occupancy sensor is switched to "unoccupied", lights are triggered to turn off.

Great, that's what we expected.


### Scenario 2:
 - You enter the room, the motion sensor becomes active, triggering the dummy switch turns "on", occupancy sensor registers "occupied", triggering the lights turn on to 50%.
 - You leave the room, on the way out you flip the physical light switch and turn off the lights.
 - The motion sensor becomes inactive, dummy switch turns "off", occupancy sensor still reads "occupied" but starts internal timer (meanwhile the lights are still off).
 - 2 minutes later the occupancy sensor's "turn off" timer expires and the occupancy sensor is switched to "unoccupied", lights are triggered to turn off (but they are already off so it's all good).

In this situation the lights are turned off twice without ever being turned on between requests. This means second time they turn off nothing happens (as expected).


### Scenario 3:
 - You enter the room, the motion sensor becomes active, triggering the dummy switch turns "on", occupancy sensor registers "occupied", triggering the lights turn on to 50%.
 - You briefly exit the room (or are still to long), the motion sensor becomes inactive, dummy switch turns "off", occupancy sensor still reads "occupied" but starts internal "turn off" timer.
 - You re-enter the room (or move), the motion sensor becomes active, the dummy switch turns "on", the occupancy sensor's "turn off" timer is cancelled, the occupancy sensor still reads "occupied".
 - You work in the room for a bit, 2 minutes later, nothing happens because you're still in the room!
 - You leave the room, the motion sensor becomes inactive, dummy switch turns "off", occupancy sensor still reads "occupied" but starts internal "turn off"  timer.
 - 2 minutes later the occupancy sensor's "turn off" timer expires and the occupancy sensor is switched to "unoccupied", lights are triggered to turn off.
 
While there are quite a few steps happening here the setup is quite resilient. Even manually controlling of the "dummy" switches they will automatically come back into sync once the motion sensor changes state again.


## Multi-Sensor Scenario

Multi sensor setup is easy with this plugin because you simply tell the plugin how many "dummy" switches you need (one for each sensor). If you associate each sensor with a unique dummy switch you can setup scenarios like this:

### Walkway Lights
Say you have a long walk way, you could put a motion sensor at the bottom of the walk way, one at the top of the walk way and any number in between (if it makes sense), then tie each sensor to one "dummy" switch, then tie the occupancy sensor to your walkway lights.  Now when someone walks up as long as they are in range of any of the motion sensors the lights will stay on. Once they safely enter the house (or leave your property if they are walking away) the lights turn off on a delay.
 
### Stairway Lights
Using the same setup as above you could have a motion sensor at the bottom of the stairs, one at the top and a short delay.


## Advanced Uses
You should be able to do some pretty advance stuff by tying a single sensor (motion, contact, light bulb) to more than one "dummy" switch. 