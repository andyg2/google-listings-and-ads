/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import { useRef, useEffect, Fragment } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useAdaptiveFormContext } from '.~/components/adaptive-form';
import AppInputControl from '.~/components/app-input-control';
import ImagesSelector from './images-selector';
import TextsEditor from './texts-editor';
import AssetField from './asset-field';
import { ASSET_FORM_KEY } from '.~/constants';
import {
	ASSET_IMAGE_SPECS,
	ASSET_TEXT_SPECS,
	ASSET_DISPLAY_URL_PATH_SPECS,
} from '../assetSpecs';
import './asset-group-card.scss';

const ctaOptions = [
	{ label: 'Automated', value: '' },
	{ label: 'Learn more', value: 'learn_more' },
	{ label: 'Get quote', value: 'get_quote' },
	{ label: 'Apply now', value: 'apply_now' },
	{ label: 'Sign up', value: 'sign_up' },
	{ label: 'Contact us', value: 'contact_us' },
	{ label: 'Subscribe', value: 'subscribe' },
	{ label: 'Download', value: 'download' },
	{ label: 'Book now', value: 'book_now' },
	{ label: 'Shop now', value: 'shop_now' },
];

/**
 * Renders the Card UI for managing the an asset group.
 *
 * Please note that this component relies on an CampaignAssetsForm's context and custom adapter,
 * so it expects a `CampaignAssetsForm` to existing in its parents.
 */
export default function AssetGroupCard() {
	const firstErrorRef = useRef();
	const {
		values,
		setValue,
		getInputProps,
		adapter: { baseAssetGroup, validationRequestCount, assetGroupErrors },
	} = useAdaptiveFormContext();
	const finalUrl = baseAssetGroup[ ASSET_FORM_KEY.FINAL_URL ];
	const hostname = finalUrl ? new URL( finalUrl ).hostname : '';
	const isSelectedFinalUrl = Boolean( finalUrl );
	const ctaProps = getInputProps( ASSET_FORM_KEY.CALL_TO_ACTION_SELECTION );

	firstErrorRef.current = null;

	useEffect( () => {
		if ( validationRequestCount > 0 && firstErrorRef.current ) {
			firstErrorRef.current.scrollIntoComponent();
		}
	}, [ validationRequestCount ] );

	function getNumOfIssues( key ) {
		if ( ! isSelectedFinalUrl || validationRequestCount === 0 ) {
			return 0;
		}

		const messages = assetGroupErrors[ key ];

		if ( Array.isArray( messages ) ) {
			return messages.length;
		}
		return messages ? 1 : 0;
	}

	function renderErrors( key ) {
		if ( getNumOfIssues( key ) === 0 ) {
			return null;
		}

		return (
			<ul className="gla-asset-group-card__error-list">
				{ [ assetGroupErrors[ key ] ].flat().map( ( message ) => (
					<li key={ message }>{ message }</li>
				) ) }
			</ul>
		);
	}

	function refFirstErrorField( ref ) {
		if ( firstErrorRef.current || getNumOfIssues( this ) === 0 ) {
			return;
		}
		firstErrorRef.current = ref;
	}

	// Ideally, the initial data for `ImagesSelector` and `TextsEditor` should be `values` directly.
	// But the current WC's `Form` component can not properly set the multiple values synchronously.
	// Therefore, an additional `baseAssetGroup` is used to ensure that the updates of multiple values
	// can be performed simultaneously.
	//
	// There are three moments that need to ensure the initial data:
	// 1. After importing assets by a final URL, the asset values are set from the `AssetGroupSection`.
	//    - The fetched multiple values are set to `baseAssetGroup`.
	//    - The final URL in `baseAssetGroup` must be a valid value.
	// 2. After clearing the selected final URL, the asset values are set from the `AssetGroupSection`.
	//    - The default empty asset values are set to `baseAssetGroup`.
	//    - The final URL in `baseAssetGroup` must be null.
	// 3. When mounting this component, the asset values already synchronously exist in `values`.
	//    - The final URL in `baseAssetGroup` must be a valid value.
	//    - The value changes made by the user are only kept in `values`.
	//
	// Thus, when mounting, it needs to distinguish whether the final URL in `baseAssetGroup` is
	// already set, and it's not cleared afterward. If yes, it means the `values` should be used as
	// the initial data. Otherwise, the `baseAssetGroup` should be used.
	const isSelectedAssetGroupInitiallyRef = useRef( isSelectedFinalUrl );
	if ( ! isSelectedFinalUrl ) {
		isSelectedAssetGroupInitiallyRef.current = isSelectedFinalUrl;
	}
	const initialValues = isSelectedAssetGroupInitiallyRef.current
		? values
		: baseAssetGroup;

	return (
		<div key={ finalUrl } className="gla-asset-group-card">
			{ ASSET_IMAGE_SPECS.map( ( spec ) => {
				const initialImageUrls = initialValues[ spec.key ];
				const imageProps = getInputProps( spec.key );

				return (
					<AssetField
						key={ spec.key }
						ref={ refFirstErrorField.bind( spec.key ) }
						heading={ spec.heading }
						subheading={ spec.subheading }
						help={ spec.help }
						numOfIssues={ getNumOfIssues( spec.key ) }
						markOptional={ spec.min === 0 }
						disabled={ ! isSelectedFinalUrl }
						initialExpanded={ isSelectedFinalUrl }
					>
						<ImagesSelector
							initialImageUrls={ initialImageUrls }
							maxNumberOfImages={ spec.getMax( values ) }
							reachedMaxNumberTip={ spec.getMaxNumberTip(
								values
							) }
							imageConfig={ spec.imageConfig }
							onChange={ imageProps.onChange }
						>
							{ renderErrors( spec.key ) }
						</ImagesSelector>
					</AssetField>
				);
			} ) }
			{ ASSET_TEXT_SPECS.map( ( spec ) => {
				const initialTexts = [ initialValues[ spec.key ] ].flat();
				const textProps = getInputProps( spec.key );

				return (
					<AssetField
						key={ spec.key }
						ref={ refFirstErrorField.bind( spec.key ) }
						heading={ spec.heading }
						subheading={
							<>
								{ spec.subheading }
								{ isSelectedFinalUrl && spec.extraSubheading }
							</>
						}
						help={ spec.help }
						numOfIssues={ getNumOfIssues( spec.key ) }
						disabled={ ! isSelectedFinalUrl }
						initialExpanded={ isSelectedFinalUrl }
					>
						<TextsEditor
							initialTexts={ initialTexts }
							minNumberOfTexts={ spec.min }
							maxNumberOfTexts={ spec.max }
							maxCharacterCounts={ spec.maxCharacterCounts }
							placeholder={ spec.capitalizedName }
							addButtonText={ spec.addButtonText }
							onChange={ ( texts ) => {
								if ( spec.requiredSingleValue ) {
									textProps.onChange( texts[ 0 ] );
								} else {
									textProps.onChange( texts );
								}
							} }
						>
							{ renderErrors( spec.key ) }
						</TextsEditor>
					</AssetField>
				);
			} ) }
			<AssetField
				className="gla-asset-field-call-to-action"
				heading={ __( 'Call to action', 'google-listings-and-ads' ) }
				help={ __(
					'Select a call to action that aligns with your goals, or use automated call to action which allows Google to automatically choose the most relevant call to action for you.',
					'google-listings-and-ads'
				) }
				disabled={ ! isSelectedFinalUrl }
				initialExpanded={ isSelectedFinalUrl }
			>
				<SelectControl
					options={ ctaOptions }
					value={ ctaProps.value || ctaOptions[ 0 ].value }
					onChange={ ctaProps.onChange }
				/>
			</AssetField>
			<AssetField
				ref={ refFirstErrorField.bind(
					ASSET_FORM_KEY.DISPLAY_URL_PATH
				) }
				className="gla-asset-field-display-url-path"
				heading={ __( 'Display URL Path', 'google-listings-and-ads' ) }
				subheading={ hostname }
				help={
					<>
						<div>
							{ __(
								`The display URL gives potential customers a clear idea of what webpage they'll reach once they click your ad, so your path text should describe your ad's landing page.`,
								'google-listings-and-ads'
							) }
						</div>
						<div>
							{ __(
								`To create your display URL, Google Ads will combine the domain (for example, "www.google.com" in www.google.com/nonprofits) from your final URL and the path text (for example, "nonprofits" in www.google.com/nonprofits).`,
								'google-listings-and-ads'
							) }
						</div>
					</>
				}
				numOfIssues={ getNumOfIssues(
					ASSET_FORM_KEY.DISPLAY_URL_PATH
				) }
				markOptional
				disabled={ ! isSelectedFinalUrl }
				initialExpanded={ isSelectedFinalUrl }
			>
				{ ASSET_DISPLAY_URL_PATH_SPECS.map( ( spec, index ) => {
					const paths = values[ ASSET_FORM_KEY.DISPLAY_URL_PATH ];

					return (
						<Fragment key={ index }>
							<span className="gla-asset-field-display-url-path__slash">
								/
							</span>
							<AppInputControl
								className="gla-asset-field-display-url-path__text-input"
								kindCharacterCount="google-ads"
								maxCharacterCount={ spec.maxCharacterCount }
								value={ paths[ index ] || '' }
								onChange={ ( value ) => {
									const nextValue = paths.slice();
									nextValue[ index ] = value;
									setValue(
										ASSET_FORM_KEY.DISPLAY_URL_PATH,
										nextValue
									);
								} }
							/>
						</Fragment>
					);
				} ) }
				{ renderErrors( ASSET_FORM_KEY.DISPLAY_URL_PATH ) }
			</AssetField>
		</div>
	);
}
