import parseUnit from 'parse-unit'
import deepCopy from 'deepcopy'
import eases from 'eases'

const instances = []

/**
 * Returns all active instances from an array.
 * @param {Array} instances
 * @returns {Array} instances - Active instances.
 */
const getActiveInstances = function(instances) {

	return instances.filter((instance) => instance.isActive())

}

/**
 * Returns the number of scrolled pixels.
 * @returns {Integer} scrollTop
 */
const getScrollTop = function() {

	// Use scrollTop because is's faster than getBoundingClientRect()
	return document.scrollingElement.scrollTop

}

/**
 * Returns the height of the viewport.
 * @returns {Integer} viewportHeight
 */
const getViewportHeight = function() {

	return (window.innerHeight || window.outerHeight)

}

/**
 * Checks if a value is absolute.
 * An absolute value must have a value that's not NaN.
 * @param {String|Integer} value
 * @returns {Boolean} isAbsolute
 */
const isAbsoluteValue = function(value) {

	return (isNaN(parseUnit(value)[0])===true ? false : true)

}

/**
 * Parses an absolute value.
 * @param {String|Integer} value
 * @returns {Object} value - Parsed value.
 */
const parseAbsoluteValue = function(value) {

	const parsedValue = parseUnit(value)

	return {
		value : parsedValue[0],
		unit  : parsedValue[1]
	}

}

/**
 * Checks if a value is relative.
 * A relative value must start and end with [a-z] and needs a '-' in the middle.
 * @param {String|Integer} value
 * @returns {Boolean} isRelative
 */
const isRelativeValue = function(value) {

	return (String(value).match(/^[a-z]+-[a-z]+$/)===null ? false : true)

}

/**
 * Converts a relative value to an absolute value.
 * @param {String} value
 * @param {Node} elem - Anchor of the relative value.
 * @param {?Integer} scrollTop - Pixels scrolled in document.
 * @param {?Integer} viewportHeight - Height of the viewport.
 * @returns {String} value - Absolute value.
 */
const relativeToAbsoluteValue = function(value, elem, scrollTop = getScrollTop(), viewportHeight = getViewportHeight()) {

	const elemSize = elem.getBoundingClientRect()

	const elemAnchor     = value.match(/^[a-z]+/)[0]
	const viewportAnchor = value.match(/[a-z]+$/)[0]

	let y = 0

	if (viewportAnchor==='top')    y -= 0
	if (viewportAnchor==='middle') y -= viewportHeight / 2
	if (viewportAnchor==='bottom') y -= viewportHeight

	if (elemAnchor==='top')    y += (elemSize.top + scrollTop)
	if (elemAnchor==='middle') y += (elemSize.top + scrollTop) + elemSize.height / 2
	if (elemAnchor==='bottom') y += (elemSize.top + scrollTop) + elemSize.height

	return `${ y }px`

}

/**
 * Validates data and sets defaults for undefined properties.
 * @param {?Object} data
 * @returns {Object} data - Validated data.
 */
const validate = function(data = {}) {

	// Deep copy object to avoid changes by reference
	data = deepCopy(data)

	if (data.from==null) throw new Error('Missing property `from`')
	if (data.to==null)   throw new Error('Missing property `to`')

	if (data.elem==null) {

		if (isAbsoluteValue(data.from)===false) throw new Error('Property `from` must be a absolute value when no `elem` has been provided')
		if (isAbsoluteValue(data.to)===false)   throw new Error('Property `to` must be a absolute value when no `elem` has been provided')

	} else {

		if (isRelativeValue(data.from)===true) data.from = relativeToAbsoluteValue(data.from, data.elem)
		if (isRelativeValue(data.to)===true)   data.to   = relativeToAbsoluteValue(data.to, data.elem)

	}

	data.from = parseAbsoluteValue(data.from)
	data.to   = parseAbsoluteValue(data.to)

	forEachProp(data.props, (prop) => {

		if (isAbsoluteValue(prop.from)===false) throw new Error('Property `from` of prop must be a absolute value')
		if (isAbsoluteValue(prop.to)===false)   throw new Error('Property `from` of prop must be a absolute value')

		prop.from = parseAbsoluteValue(prop.from)
		prop.to   = parseAbsoluteValue(prop.to)

		if (typeof prop.timing==='string' && eases[prop.timing]==null) throw new Error('Unknown timing for property `timing` of prop')

		if (prop.timing==null)             prop.timing = eases['linear']
		if (typeof prop.timing==='string') prop.timing = eases[prop.timing]

	})

	return data

}

/**
 * Updates instance props and their values.
 * @param {Object} data
 * @param {?Integer} scrollTop - Pixels scrolled in document.
 * @returns {Array} props - Updated props.
 */
const update = function(data, scrollTop = getScrollTop()) {

	// 100% in pixel
	const total = data.to.value - data.from.value

	// Pixel already scrolled
	const current = scrollTop - data.from.value

	// Percent already scrolled
	let percentage = (current) / (total / 100)

	// Normalize percentage
	if (percentage<=0)  percentage = 0
	if (percentage>100) percentage = 100

	const values = []

	// Update each value
	forEachProp(data.props, (prop, key) => {

		// Use the unit of from OR to. It's valid to animate from '0' to '100px' and
		// '0' should be treated as 'px', too. Unit will be an empty string when no unit given.
		const unit = prop.from.unit || prop.to.unit

		// The value that should be interpolated
		const diff  = prop.from.value - prop.to.value

		// All easing functions only remap a time value, and all have the same signature.
		// Typically a value between 0 and 1, and it returns a new float that has been eased.
		const time = prop.timing(percentage / 100)

		const value = prop.from.value - diff * time

		// Round to avoid unprecise values.
		// The precision of floating point computations is only as precise as the precision it uses.
		// http://stackoverflow.com/questions/588004/is-floating-point-math-broken
		const rounded = Math.round(value * 100) / 100

		values.push({
			key   : key,
			value : rounded + unit
		})

	})

	return values

}

/**
 * Executes a function for each prop in props.
 * @param {Object} props - Object with props as properties.
 * @param {Function} fn - Function to execute.
 */
const forEachProp = function(props, fn) {

	for (const key in props) fn(props[key], key, props)

}

/**
 * Adds a property with the specified name and value to a given style object.
 * @param {Object} prop - Object with a key and value.
 */
const setProp = function(prop) {

	document.documentElement.style.setProperty(prop.key, prop.value)

}

/**
 * Gets and sets new props when the user has scrolled and when there are active instances.
 * This part get executed with every frame. Make sure it's performant as hell.
 * @param {Object} style - Style object.
 * @param {?Integer} previousScrollTop
 */
const loop = function(style, previousScrollTop) {

	// Continue loop
	const repeat = () => {

		// It depends on the browser, but it turns out that closures
		// are sometimes faster than .bind or .apply.
		requestAnimationFrame(() => loop(style, previousScrollTop))

	}

	// Get all active instances
	const activeInstances = getActiveInstances(instances)

	// Only continue when active instances available
	if (activeInstances.length===0) return repeat()

	const scrollTop = getScrollTop()

	// Only continue when scrollTop has changed
	if (previousScrollTop===scrollTop) return repeat()
	else previousScrollTop = scrollTop

	// Get new props of each instance
	const newProps = activeInstances.map((instance) => instance.update(scrollTop))

	// Flatten props because each update can return multiple props.
	// The second parameter of contact takes an array, so the line is identical to:
	// [].concat(['1'], ['2'], ['3'])
	const flattedProps = [].concat.apply([], newProps)

	// Set new props
	flattedProps.forEach((prop) => setProp(prop))

	repeat()

}

/**
 * Creats a new instance.
 * @param {Object} data
 * @returns {Object} instance
 */
export const create = function(data) {

	// Store the parsed data
	let _data = null

	// Store if instance is started or stopped
	let active = false

	// Returns if instance is started or stopped
	const _isActive = () => {

		return active

	}

	// Parses and calculates data
	const _calculate = function() {

		_data = validate(data)

	}

	// Update props
	const _update = (scrollTop) => {

		return update(_data, scrollTop)

	}

	// Starts to animate
	const _start = () => {

		active = true

	}

	// Stops to animate
	const _stop = () => {

		active = false

	}

	// Assign instance to a variable so the instance can be used
	// elsewhere in the current function
	const instance = {
		isActive  : _isActive,
		calculate : _calculate,
		update    : _update,
		start     : _start,
		stop      : _stop
	}

	// Store instance in global array
	instances.push(instance)

	// Calculate data for the first time
	instance.calculate()

	return instance

}

// Start to loop
loop()