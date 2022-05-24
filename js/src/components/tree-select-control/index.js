/**
 * External dependencies
 */
import { noop } from 'lodash';
import { __ } from '@wordpress/i18n';
import { focus } from '@wordpress/dom';
import { useEffect, useMemo, useState, useRef } from '@wordpress/element';
import classnames from 'classnames';
import {
	__experimentalUseFocusOutside as useFocusOutside,
	useInstanceId,
} from '@wordpress/compose';

/**
 * Internal dependencies
 */
import useIsEqualRefValue from '.~/hooks/useIsEqualRefValue';
import Control from './control';
import Options from './options';
import './index.scss';
import { ARROW_DOWN, ARROW_UP, ENTER, ESCAPE, ROOT_VALUE } from './constants';

/**
 * Example of Options data structure:
 *   [
       {
			value: 'EU',
			label: 'Europe',
			children: [
				{ value: 'ES', label: 'Spain' },
				{ value: 'FR', label: 'France', children: [] }, // defining children as [] is equivalent to don't have children
			],
		},
		{
			value: 'NA',
			label: 'North America',
			children: [
				{ value: 'US', label: 'United States', [
					{ value: 'TX', label: 'Texas' },
					{ value: 'NY', label: 'New York' },
				] },
				{ value: 'CA', label: 'Canada' },
			],
		}
     ],
 **/

/**
 * @typedef {Object} CommonOption
 * @property {string} value The value for the option
 * @property {string} [key] Optional unique key for the Option. It will fallback to the value property if not defined
 */

/**
 * @typedef {Object} BaseOption
 * @property {string} label The label for the option
 * @property {Option[]} [children] The children Option objects
 *
 * @typedef {CommonOption & BaseOption} Option
 */

/**
 * @typedef {Object} BaseInnerOption
 * @property {string|JSX.Element} label The label string or label with highlighted react element for the option.
 * @property {InnerOption[]|undefined} children The (filtered) children options.
 * @property {boolean} hasChildren Whether this option has children.
 * @property {InnerOption[]} allLeaves All (filtered) leaf options under this option.
 * @property {boolean} checked Whether this option is checked.
 * @property {boolean} partialChecked Whether this option is partially checked.
 * @property {boolean} expanded Whether this option is expanded.
 *
 * @typedef {CommonOption & BaseInnerOption} InnerOption
 */

/**
 * Renders a component with a searchable control, tags and a tree selector.
 *
 * @param {Object} props Component props.
 * @param {string} [props.id] Component id
 * @param {string} [props.label] Label for the component
 * @param {string | false} [props.selectAllLabel] Label for the Select All root element. False for disable.
 * @param {string} [props.help] Help text under the select input.
 * @param {string} [props.placeholder] Placeholder for the search control input
 * @param {string} [props.className] The class name for this component
 * @param {boolean} [props.disabled] Disables the component
 * @param {Option[]} [props.options] Options to show in the component
 * @param {string[]} [props.value] Selected values
 * @param {number} [props.maxVisibleTags] The maximum number of tags to show. Undefined, 0 or less than 0 evaluates to "Show All".
 * @param {Function} [props.onChange] Callback when the selector changes
 * @param {(visible: boolean) => void} [props.onDropdownVisibilityChange] Callback when the visibility of the dropdown options is changed.
 * @return {JSX.Element} The component
 */
const TreeSelectControl = ( {
	id,
	label,
	selectAllLabel = __( 'All', 'google-listings-and-ads' ),
	help,
	placeholder,
	className,
	disabled,
	options = [],
	value = [],
	maxVisibleTags,
	onChange = () => {},
	onDropdownVisibilityChange = noop,
} ) => {
	let instanceId = useInstanceId( TreeSelectControl );
	instanceId = id ?? instanceId;

	const [ treeVisible, setTreeVisible ] = useState( false );
	const [ nodesExpanded, setNodesExpanded ] = useState( [] );
	const [ inputControlValue, setInputControlValue ] = useState( '' );

	const dropdownRef = useRef();
	const onDropdownVisibilityChangeRef = useRef();
	onDropdownVisibilityChangeRef.current = onDropdownVisibilityChange;

	// We will save in a REF previous search filter queries to avoid re-query the tree and save performance
	const filteredOptionsCache = useRef( {} );
	const cacheStatesRef = useRef( {} );
	cacheStatesRef.current.expandedValues = nodesExpanded;
	cacheStatesRef.current.selectedValues = value;

	const showTree = ! disabled && treeVisible;

	const root =
		selectAllLabel !== false
			? {
					label: selectAllLabel,
					value: ROOT_VALUE,
					children: options,
			  }
			: null;

	const treeOptions = useIsEqualRefValue( root ? [ root ] : options );

	const focusOutside = useFocusOutside( () => {
		setTreeVisible( false );
	} );

	const hasChildren = ( option ) => option.children?.length;
	const filterQuery = inputControlValue.trim().toLowerCase();
	const filter = filterQuery.length >= 3 ? filterQuery : '';

	/**
	 * Optimizes the performance for getting the tags info
	 */
	const optionsRepository = useMemo( () => {
		const repository = {};

		filteredOptionsCache.current = []; // clear cache if options change

		function loadOption( option ) {
			option.children?.forEach( loadOption );
			repository[ option.key ?? option.value ] = option;
		}

		treeOptions.forEach( loadOption );

		return repository;
	}, [ treeOptions ] );

	/*
	 * Perform the search query filter in the Tree options
	 *
	 * 1. Check if the search query is already cached and return it if so.
	 * 2. Deep copy the tree with adding properties for rendering.
	 * 3. In case of filter, we apply the filter option function to the tree.
	 * 4. In the filter function we also highlight the label with the matching letters
	 * 5. Finally we set the cache with the obtained results and apply the filters
	 */
	const filteredOptions = useMemo( () => {
		const cachedFilteredOptions = filteredOptionsCache.current[ filter ];

		if ( cachedFilteredOptions ) {
			return cachedFilteredOptions;
		}

		const isFiltered = Boolean( filter );
		const { current } = cacheStatesRef;

		const highlightOptionLabel = ( optionLabel, matchPosition ) => {
			const matchLength = matchPosition + filter.length;

			if ( ! isFiltered ) return optionLabel;

			return (
				<span>
					<span>{ optionLabel.substring( 0, matchPosition ) }</span>
					<strong>
						{ optionLabel.substring( matchPosition, matchLength ) }
					</strong>
					<span>{ optionLabel.substring( matchLength ) }</span>
				</span>
			);
		};

		const descriptors = {
			allLeaves: {
				/**
				 * Returns all (filtered) leaf options under this option.
				 *
				 * @return {InnerOption[]} All (filtered) leaf options under this option.
				 */
				get() {
					if ( ! this.hasChildren ) {
						return [];
					}
					return this.children.flatMap( ( option ) => {
						return option.hasChildren ? option.allLeaves : option;
					} );
				},
			},
			checked: {
				/**
				 * Returns whether this option is checked.
				 * A child option is checked its value is selected.
				 * A parent option is checked if all leaves are checked.
				 *
				 * @return {boolean} True if checked, false otherwise.
				 */
				get() {
					if ( this.hasChildren ) {
						return this.allLeaves.every( ( opt ) => opt.checked );
					}
					return current.selectedValues.includes( this.value );
				},
			},
			partialChecked: {
				/**
				 * Returns whether this option is partially checked.
				 * A child option always returns false.
				 * A parent option is partially checked if at least one but not all leaves are checked.
				 *
				 * @return {boolean} True if partially checked, false otherwise.
				 */
				get() {
					if ( ! this.hasChildren ) {
						return false;
					}
					return (
						! this.checked &&
						this.allLeaves.some(
							( opt ) => opt.checked || opt.partialChecked
						)
					);
				},
			},
			expanded: {
				/**
				 * Returns whether this option is expanded.
				 * A child option always returns false.
				 *
				 * @return {boolean} True if expanded, false otherwise.
				 */
				get() {
					return (
						isFiltered ||
						this.value === ROOT_VALUE ||
						current.expandedValues.includes( this.value )
					);
				},
			},
		};

		const reduceOptions = ( acc, { children = [], ...option } ) => {
			option.hasChildren = children.length > 0;

			if ( option.hasChildren ) {
				option.children = children.reduce( reduceOptions, [] );

				if ( option.children.length ) {
					Object.defineProperties( option, descriptors );
					acc.push( option );
				}
			} else {
				if ( isFiltered ) {
					const match = option.label.toLowerCase().indexOf( filter );
					if ( match === -1 ) {
						return acc;
					}
					option.label = highlightOptionLabel( option.label, match );
				}

				Object.defineProperties( option, descriptors );
				acc.push( option );
			}

			return acc;
		};

		const filteredTreeOptions = treeOptions.reduce( reduceOptions, [] );
		filteredOptionsCache.current[ filter ] = filteredTreeOptions;

		return filteredTreeOptions;
	}, [ treeOptions, filter ] );

	const onKeyDown = ( event ) => {
		if ( disabled ) return;

		if ( ESCAPE === event.key ) {
			setTreeVisible( false );
		}

		if ( ENTER === event.key ) {
			setTreeVisible( true );
			event.preventDefault();
		}

		const stepDict = {
			[ ARROW_UP ]: -1,
			[ ARROW_DOWN ]: 1,
		};
		const step = stepDict[ event.key ];

		if ( step && dropdownRef.current && filteredOptions.length ) {
			const elements = focus.focusable
				.find( dropdownRef.current )
				.filter( ( el ) => el.type === 'checkbox' );
			const currentIndex = elements.indexOf( event.target );
			const index = Math.max( currentIndex + step, -1 ) % elements.length;
			elements.at( index ).focus();
			event.preventDefault();
		}
	};

	useEffect( () => {
		onDropdownVisibilityChangeRef.current( showTree );
	}, [ showTree ] );

	/**
	 * Get formatted Tags from the selected values.
	 *
	 * @return {Array<{id: string, label: string|undefined}>} An array of Tags
	 */
	const getTags = () => {
		if ( ! options.length ) {
			return [];
		}

		return value.map( ( key ) => {
			const option = optionsRepository[ key ];
			return { id: key, label: option?.label };
		} );
	};

	const handleExpanderClick = ( e ) => {
		const elements = focus.focusable.find( dropdownRef.current );
		const index = elements.indexOf( e.currentTarget ) + 1;
		elements.at( index ).focus();
	};

	/**
	 * Expands/Collapses the Option
	 *
	 * @param {InnerOption} option The option to be expanded or collapsed.
	 */
	const handleToggleExpanded = ( option ) => {
		setNodesExpanded(
			option.expanded
				? nodesExpanded.filter( ( el ) => option.value !== el )
				: [ ...nodesExpanded, option.value ]
		);
	};

	/**
	 * Handles a change on the Tree options. Could be a click on a parent option
	 * or a child option
	 *
	 * @param {boolean} checked Indicates if the item should be checked
	 * @param {Option} option The option to change
	 */
	const handleOptionsChange = ( checked, option ) => {
		if ( hasChildren( option ) ) {
			handleParentChange( checked, option );
		} else {
			handleSingleChange( checked, option );
		}
	};

	/**
	 * Handles a change of a child element.
	 *
	 * @param {boolean} checked Indicates if the item should be checked
	 * @param {Option} option The option to change
	 */
	const handleSingleChange = ( checked, option ) => {
		const newValue = checked
			? [ ...value, option.value ]
			: value.filter( ( el ) => el !== option.value );

		onChange( newValue );
	};

	/**
	 * Handles a change of a Parent element.
	 *
	 * @param {boolean} checked Indicates if the item should be checked
	 * @param {Option} option The option to change
	 */
	const handleParentChange = ( checked, option ) => {
		const newValue = [ ...value ];

		if ( checked && ! nodesExpanded.includes( option.value ) ) {
			setNodesExpanded( [ ...nodesExpanded, option.value ] );
		}

		function loadChildren( parent ) {
			if ( ! parent.children ) {
				return;
			}

			parent.children.forEach( ( child ) => {
				if ( hasChildren( child ) ) {
					loadChildren( child );
					return;
				}

				const childPosition = newValue.indexOf( child.value );

				if ( ! checked && childPosition >= 0 ) {
					newValue.splice( childPosition, 1 );
				}

				if ( checked && childPosition < 0 ) {
					newValue.push( child.value );
				}
			} );
		}

		loadChildren( option );
		onChange( newValue );
	};

	/**
	 * Handles a change of a Tag element. We map them to Value format.
	 *
	 * @param {Array} tags List of current tags
	 */
	const handleTagsChange = ( tags ) => {
		onChange( [ ...tags.map( ( el ) => el.id ) ] );
	};

	/**
	 * Prepares and sets the search filter.
	 * Filters of less than 3 characters are not considered, so we convert them to ''
	 *
	 * @param {Event} e Event returned by the On Change function in the Input control
	 */
	const handleOnInputChange = ( e ) => {
		setInputControlValue( e.target.value );
	};

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			{ ...focusOutside }
			onKeyDown={ onKeyDown }
			className={ classnames(
				'woocommerce-tree-select-control',
				className
			) }
		>
			{ !! label && (
				<label
					htmlFor={ `woocommerce-tree-select-control-${ instanceId }__control-input` }
					className="woocommerce-tree-select-control__label"
				>
					{ label }
				</label>
			) }

			<Control
				disabled={ disabled }
				tags={ getTags() }
				isExpanded={ showTree }
				onFocus={ () => {
					setTreeVisible( true );
				} }
				onControlClick={ () => {
					if ( disabled ) return;
					setTreeVisible( true );
				} }
				instanceId={ instanceId }
				placeholder={ placeholder }
				label={ label }
				maxVisibleTags={ maxVisibleTags }
				onTagsChange={ handleTagsChange }
				onInputChange={ handleOnInputChange }
			/>
			{ showTree && (
				<div
					ref={ dropdownRef }
					className="woocommerce-tree-select-control__tree"
					role="tree"
					tabIndex="-1"
				>
					<Options
						options={ filteredOptions }
						onChange={ handleOptionsChange }
						onExpanderClick={ handleExpanderClick }
						onToggleExpanded={ handleToggleExpanded }
					/>
				</div>
			) }
			{ help && (
				<div className="woocommerce-tree-select-control__help">
					{ help }
				</div>
			) }
		</div>
	);
};

export default TreeSelectControl;
