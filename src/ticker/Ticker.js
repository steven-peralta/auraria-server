/*
    this code is literally just stolen from the Pixi.js ticker library because im a lazy asshole
    you can see the original code here: https://github.com/pixijs/pixi.js/blob/dev/src/core/ticker/Ticker.js
    their license (MIT) states that we have to include this copyright notice, so here it is:

    The MIT License

    Copyright (c) 2013-2017 Mathew Groves, Chad Engler

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
 */

import Action from './Action';
const { performance } = require('perf_hooks');

export const UPDATE_PRIORITY = {
    INTERACTION: 50,
    HIGH: 25,
    NORMAL: 0,
    LOW: -25,
    UTILITY: -50,
};

export default class Ticker
{
    constructor(tickRate = 20)
    {
        this.tickRate = tickRate;
        this._timeout = null;
        /**
         * The first listener. All new listeners added are chained on this.
         * @private
         * @type {TickerListener}
         */
        this._head = new Action(null, null, Infinity);

        /**
         * Internal value managed by minFPS property setter and getter.
         * This is the maximum allowed milliseconds between updates.
         * @private
         */
        this._maxElapsedMS = 100;

        /**
         * Whether or not this ticker should invoke the method
         * {@link PIXI.ticker.Ticker#start} automatically
         * when a listener is added.
         *
         * @member {boolean}
         * @default false
         */
        this.autoStart = false;

        /**
         * Scalar time value from last frame to this frame.
         * This value is capped by setting {@link PIXI.ticker.Ticker#minFPS}
         * and is scaled with {@link PIXI.ticker.Ticker#speed}.
         * **Note:** The cap may be exceeded by scaling.
         *
         * @member {number}
         * @default 1
         */
        this.deltaTime = 1;

        /**
         * Time elapsed in milliseconds from last frame to this frame.
         * Opposed to what the scalar {@link PIXI.ticker.Ticker#deltaTime}
         * is based, this value is neither capped nor scaled.
         * If the platform supports DOMHighResTimeStamp,
         * this value will have a precision of 1 µs.
         * Defaults to target frame time
         *
         * @member {number}
         * @default 16.66
         */
        this.elapsedMS = 1 / (this.tickRate/1000);

        /**
         * The last time {@link PIXI.ticker.Ticker#update} was invoked.
         * This value is also reset internally outside of invoking
         * update, but only when a new animation frame is requested.
         * If the platform supports DOMHighResTimeStamp,
         * this value will have a precision of 1 µs.
         *
         * @member {number}
         * @default -1
         */
        this.lastTime = -1;

        /**
         * Factor of current {@link PIXI.ticker.Ticker#deltaTime}.
         * @example
         * // Scales ticker.deltaTime to what would be
         * // the equivalent of approximately 120 FPS
         * ticker.speed = 2;
         *
         * @member {number}
         * @default 1
         */
        this.speed = 1;

        /**
         * Whether or not this ticker has been started.
         * `true` if {@link PIXI.ticker.Ticker#start} has been called.
         * `false` if {@link PIXI.ticker.Ticker#stop} has been called.
         * While `false`, this value may change to `true` in the
         * event of {@link PIXI.ticker.Ticker#autoStart} being `true`
         * and a listener is added.
         *
         * @member {boolean}
         * @default false
         */
        this.started = false;

        /**
         * Internal tick method bound to ticker instance.
         * This is because in early 2015, Function.bind
         * is still 60% slower in high performance scenarios.
         * Also separating frame requests from update method
         * so listeners may be called at any time and with
         * any animation API, just invoke ticker.update(time).
         *
         * @private
         * @param {number} time - Time since last tick.
         */
        this._tick = (time) =>
        {
            this._timeout = null;

            if (this.started)
            {
                // Invoke listeners now
                this.update(time);
                // Listener side effects may have modified ticker state.
                if (this.started && this._timeout === null && this._head.next)
                {
                    this._timeout = setTimeout(this._tick, 1 / (this.tickRate/1000));
                }
            }
        };
    }

    /**
     * Conditionally requests a new animation frame.
     * If a frame has not already been requested, and if the internal
     * emitter has listeners, a new frame is requested.
     *
     * @private
     */
    _requestIfNeeded()
    {
        if (this._timeout === null && this._head.next)
        {
            // ensure callbacks get correct delta
            this.lastTime = performance.now();
            this._timeout = setTimeout(this._tick, 1 / (this.tickRate/1000));
        }
    }

    /**
     * Conditionally cancels a pending animation frame.
     *
     * @private
     */
    _cancelIfNeeded()
    {
        if (this._timeout !== null)
        {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }

    /**
     * Conditionally requests a new animation frame.
     * If the ticker has been started it checks if a frame has not already
     * been requested, and if the internal emitter has listeners. If these
     * conditions are met, a new frame is requested. If the ticker has not
     * been started, but autoStart is `true`, then the ticker starts now,
     * and continues with the previous conditions to request a new frame.
     *
     * @private
     */
    _startIfPossible()
    {
        if (this.started)
        {
            this._requestIfNeeded();
        }
        else if (this.autoStart)
        {
            this.start();
        }
    }

    /**
     * Register a handler for tick events. Calls continuously unless
     * it is removed or the ticker is stopped.
     *
     * @param {Function} fn - The listener function to be added for updates
     * @param {Function} [context] - The listener context
     * @param {number} [priority=PIXI.UPDATE_PRIORITY.NORMAL] - The priority for emitting
     * @returns {PIXI.ticker.Ticker} This instance of a ticker
     */
    add(fn, context, priority = UPDATE_PRIORITY.NORMAL)
    {
        return this._addListener(new Action(fn, context, priority));
    }

    /**
     * Add a handler for the tick event which is only execute once.
     *
     * @param {Function} fn - The listener function to be added for one update
     * @param {Function} [context] - The listener context
     * @param {number} [priority=PIXI.UPDATE_PRIORITY.NORMAL] - The priority for emitting
     * @returns {PIXI.ticker.Ticker} This instance of a ticker
     */
    addOnce(fn, context, priority = UPDATE_PRIORITY.NORMAL)
    {
        return this._addListener(new Action(fn, context, priority, true));
    }

    /**
     * Internally adds the event handler so that it can be sorted by priority.
     * Priority allows certain handler (user, AnimatedSprite, Interaction) to be run
     * before the rendering.
     *
     * @private
     * @param {TickerListener} listener - Current listener being added.
     * @returns {PIXI.ticker.Ticker} This instance of a ticker
     */
    _addListener(action)
    {
        // For attaching to head
        let current = this._head.next;
        let previous = this._head;

        // Add the first item
        if (!current)
        {
            action.connect(previous);
        }
        else
        {
            // Go from highest to lowest priority
            while (current)
            {
                if (action.priority > current.priority)
                {
                    action.connect(previous);
                    break;
                }
                previous = current;
                current = current.next;
            }

            // Not yet connected
            if (!action.previous)
            {
                action.connect(previous);
            }
        }

        this._startIfPossible();

        return this;
    }

    /**
     * Removes any handlers matching the function and context parameters.
     * If no handlers are left after removing, then it cancels the animation frame.
     *
     * @param {Function} fn - The listener function to be removed
     * @param {Function} [context] - The listener context to be removed
     * @returns {PIXI.ticker.Ticker} This instance of a ticker
     */
    remove(fn, context)
    {
        let action = this._head.next;

        while (action)
        {
            // We found a match, lets remove it
            // no break to delete all possible matches
            // incase a listener was added 2+ times
            if (action.match(fn, context))
            {
                action = action.destroy();
            }
            else
            {
                action = action.next;
            }
        }

        if (!this._head.next)
        {
            this._cancelIfNeeded();
        }

        return this;
    }

    /**
     * Starts the ticker. If the ticker has listeners
     * a new animation frame is requested at this point.
     */
    start()
    {
        if (!this.started)
        {
            this.started = true;
            this._requestIfNeeded();
        }
    }

    /**
     * Stops the ticker. If the ticker has requested
     * an animation frame it is canceled at this point.
     */
    stop()
    {
        if (this.started)
        {
            this.started = false;
            this._cancelIfNeeded();
        }
    }

    /**
     * Destroy the ticker and don't use after this. Calling
     * this method removes all references to internal events.
     */
    destroy()
    {
        this.stop();

        let action = this._head.next;

        while (action)
        {
            action = action.destroy(true);
        }

        this._head.destroy();
        this._head = null;
    }

    /**
     * Triggers an update. An update entails setting the
     * current {@link PIXI.ticker.Ticker#elapsedMS},
     * the current {@link PIXI.ticker.Ticker#deltaTime},
     * invoking all listeners with current deltaTime,
     * and then finally setting {@link PIXI.ticker.Ticker#lastTime}
     * with the value of currentTime that was provided.
     * This method will be called automatically by animation
     * frame callbacks if the ticker instance has been started
     * and listeners are added.
     *
     * @param {number} [currentTime=performance.now()] - the current time of execution
     */
    update(currentTime = performance.now())
    {
        let elapsedMS;

        // If the difference in time is zero or negative, we ignore most of the work done here.
        // If there is no valid difference, then should be no reason to let anyone know about it.
        // A zero delta, is exactly that, nothing should update.
        //
        // The difference in time can be negative, and no this does not mean time traveling.
        // This can be the result of a race condition between when an animation frame is requested
        // on the current JavaScript engine event loop, and when the ticker's start method is invoked
        // (which invokes the internal _requestIfNeeded method). If a frame is requested before
        // _requestIfNeeded is invoked, then the callback for the animation frame the ticker requests,
        // can receive a time argument that can be less than the lastTime value that was set within
        // _requestIfNeeded. This difference is in microseconds, but this is enough to cause problems.
        //
        // This check covers this browser engine timing issue, as well as if consumers pass an invalid
        // currentTime value. This may happen if consumers opt-out of the autoStart, and update themselves.

        if (currentTime > this.lastTime)
        {
            // Save uncapped elapsedMS for measurement
            elapsedMS = this.elapsedMS = currentTime - this.lastTime;

            // cap the milliseconds elapsed used for deltaTime
            if (elapsedMS > this._maxElapsedMS)
            {
                elapsedMS = this._maxElapsedMS;
            }

            this.deltaTime = elapsedMS * (this.tickRate/1000) * this.speed;

            // Cache a local reference, in-case ticker is destroyed
            // during the emit, we can still check for head.next
            const head = this._head;

            // Invoke listeners added to internal emitter
            let action = head.next;

            while (action)
            {
                action = action.emit(this.deltaTime);
            }

            if (!head.next)
            {
                this._cancelIfNeeded();
            }
        }
        else
        {
            this.deltaTime = this.elapsedMS = 0;
        }

        this.lastTime = currentTime;
    }

    /**
     * The frames per second at which this ticker is running.
     * The default is approximately 60 in most modern browsers.
     * **Note:** This does not factor in the value of
     * {@link PIXI.ticker.Ticker#speed}, which is specific
     * to scaling {@link PIXI.ticker.Ticker#deltaTime}.
     *
     * @member {number}
     * @readonly
     */
    get TPS()
    {
        return 1000 / this.elapsedMS;
    }

    /**
     * Manages the maximum amount of milliseconds allowed to
     * elapse between invoking {@link PIXI.ticker.Ticker#update}.
     * This value is used to cap {@link PIXI.ticker.Ticker#deltaTime},
     * but does not effect the measured value of {@link PIXI.ticker.Ticker#FPS}.
     * When setting this property it is clamped to a value between
     * `0` and `PIXI.settings.TARGET_FPMS * 1000`.
     *
     * @member {number}
     * @default 10
     */
    get minTPS()
    {
        return 1000 / this._maxElapsedMS;
    }

    set minTPS(tps) // eslint-disable-line require-jsdoc
    {
        // Clamp: 0 to TARGET_FPMS
        const minTPMS = Math.min(Math.max(0, tps) / 1000, (this.tickRate/1000));

        this._maxElapsedMS = 1 / minTPMS;
    }
}