/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { isEqual, noop } from 'lodash';

/**
 * Internal dependencies
 */
import Subsection from '.~/wcdl/subsection';
import AppModal from '.~/components/app-modal';
import AppButton from '.~/components/app-button';
import AppSelectControl from '.~/components/app-select-control';
import useMappingAttributes from '.~/hooks/useMappingAttributes';
import useMappingAttributesSources from '.~/hooks/useMappingAttributesSources';
import AttributeMappingFieldSourcesControl from './attribute-mapping-field-sources-control';
import AttributeMappingSourceTypeSelector from './attribute-mapping-source-type-selector';
import AttributeMappingCategoryControl from '.~/attribute-mapping/attribute-mapping-category-control';
import AppSpinner from '.~/components/app-spinner';
import { useAppDispatch } from '.~/data';
import { CATEGORY_CONDITION_SELECT_TYPES } from '.~/constants';

const enumSelectorLabel = __(
	'Select default value',
	'google-listings-and-ads'
);

const attributeSelectorLabel = __(
	'Select a Google attribute that you want to manage',
	'google-listings-and-ads'
);

/**
 * Renders a modal showing a form for editing or creating an Attribute Mapping rule
 *
 * @param {Object} props React props
 * @param {Object} [props.rule] Optional rule to manage
 * @param {Function} [props.onRequestClose] Callback on closing the modal
 */
const AttributeMappingRuleModal = ( { rule, onRequestClose = noop } ) => {
	const [ newRule, setNewRule ] = useState(
		rule
			? { ...rule }
			: { category_condition_type: CATEGORY_CONDITION_SELECT_TYPES.ALL }
	);
	const [ saving, setSaving ] = useState( false );
	const [ dropdownVisible, setDropdownVisible ] = useState( false );

	const { updateMappingRule, createMappingRule } = useAppDispatch();

	const { data: attributes } = useMappingAttributes();
	const {
		data: sources = {},
		hasFinishedResolution: sourcesHasFinishedResolution,
	} = useMappingAttributesSources( newRule.attribute );

	const isEnum =
		attributes.find( ( { id } ) => id === newRule.attribute )?.enum ||
		false;

	const sourcesOptions = [
		// Todo: Check this in the future. (Due to an error on my side returning object in the backend)
		...Object.keys( sources ).map( ( sourceKey ) => {
			return {
				value: sourceKey,
				label: sources[ sourceKey ],
			};
		} ),
	];

	const attributesOptions = [
		{
			value: '',
			label: __( 'Select one attribute', 'google-listings-and-ads' ),
		},
		...attributes.map( ( attribute ) => {
			return {
				value: attribute.id,
				label: attribute.label,
			};
		} ),
	];

	const isValidRule =
		newRule.hasOwnProperty( 'source' ) &&
		newRule.hasOwnProperty( 'attribute' ) &&
		( newRule.category_condition_type ===
			CATEGORY_CONDITION_SELECT_TYPES.ALL ||
			newRule.categories?.length > 0 ) &&
		! isEqual( newRule, rule );

	const getParsedRule = () => {
		const parsedRule = { ...newRule };
		if ( ! parsedRule.categories?.length ) {
			delete parsedRule.categories;
		}

		return parsedRule;
	};

	const onSave = async () => {
		setSaving( true );

		try {
			if ( rule ) {
				await updateMappingRule( getParsedRule() );
			} else {
				await createMappingRule( getParsedRule() );
			}
			onRequestClose();
		} catch ( error ) {
			setSaving( false );
		}
	};

	const onSourceUpdate = ( source ) => {
		setNewRule( { ...newRule, source } );
	};

	return (
		<AppModal
			overflow="visible"
			shouldCloseOnEsc={ ! dropdownVisible }
			shouldCloseOnClickOutside={ ! dropdownVisible }
			onRequestClose={ onRequestClose }
			className="gla-attribute-mapping__rule-modal"
			title={
				rule
					? __( 'Manage attribute rule', ' google-listings-and-ads' )
					: __( 'Create attribute rule', ' google-listings-and-ads' )
			}
			buttons={ [
				<AppButton key="cancel" isLink onClick={ onRequestClose }>
					{ __( 'Cancel', 'google-listings-and-ads' ) }
				</AppButton>,
				<AppButton
					disabled={ ! isValidRule || saving }
					key="save-rule"
					isPrimary
					text={
						saving
							? __( 'Saving…', 'google-listings-and-ads' )
							: __( 'Save rule', 'google-listings-and-ads' )
					}
					eventName="gla_attribute_mapping_save_rule"
					eventProps={ {
						context: 'attribute-mapping-rule-modal',
					} }
					onClick={ onSave }
				/>,
			] }
		>
			<Subsection>
				<Subsection.Title>
					{ __( 'Target attribute', 'google-listings-and-ads' ) }
				</Subsection.Title>
				<Subsection.Subtitle className="gla_attribute_mapping_helper-text">
					{ attributeSelectorLabel }
				</Subsection.Subtitle>
				<AppSelectControl
					value={ newRule.attribute }
					aria-label={ attributeSelectorLabel }
					onChange={ ( attribute ) => {
						setNewRule( { ...newRule, attribute } );
					} }
					options={ attributesOptions }
				/>
			</Subsection>

			{ ! sourcesHasFinishedResolution && <AppSpinner /> }

			{ sourcesOptions.length > 0 && sourcesHasFinishedResolution && (
				<>
					<Subsection>
						<Subsection.Title>
							{ isEnum
								? enumSelectorLabel
								: __(
										'Assign value',
										'google-listings-and-ads'
								  ) }
						</Subsection.Title>

						{ isEnum ? (
							<AttributeMappingFieldSourcesControl
								sources={ sourcesOptions }
								onChange={ onSourceUpdate }
								value={ newRule.source }
								aria-label={ enumSelectorLabel }
							/>
						) : (
							<AttributeMappingSourceTypeSelector
								sources={ sourcesOptions }
								onChange={ onSourceUpdate }
								value={ newRule.source }
							/>
						) }
					</Subsection>
					<Subsection>
						<Subsection.Title>
							{ __( 'Categories', 'google-listings-and-ads' ) }
						</Subsection.Title>
						<AttributeMappingCategoryControl
							onCategorySelectorOpen={ setDropdownVisible }
							selectedConditionalType={
								newRule.category_condition_type
							}
							selectedCategories={
								newRule.categories?.split( ',' ) || []
							}
							onConditionalTypeChange={ ( type ) => {
								setNewRule( {
									...newRule,
									category_condition_type: type,
								} );
							} }
							onCategoriesChange={ ( categories ) => {
								setNewRule( {
									...newRule,
									categories: categories.join( ',' ),
								} );
							} }
						/>
					</Subsection>
				</>
			) }
		</AppModal>
	);
};

export default AttributeMappingRuleModal;
