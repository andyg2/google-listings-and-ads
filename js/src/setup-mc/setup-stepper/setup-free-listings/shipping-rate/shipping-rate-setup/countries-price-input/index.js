/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';

/**
 * Internal dependencies
 */
import useCountryKeyNameMap from '../../../../../../hooks/useCountryKeyNameMap';
import AppInputControl from '../../../../../../components/app-input-control';
import More from '../../../components/more';
import EditRateButton from './edit-rate-button';
import './index.scss';
import useAudienceSelectedCountryCodes from '../../../../../../hooks/useAudienceSelectedCountryCodes';

const firstN = 5;

const CountriesPriceInput = ( props ) => {
	const { value, onChange } = props;
	const { countries, currency, price } = value;

	const [ selectedCountryCodes ] = useAudienceSelectedCountryCodes();
	const keyNameMap = useCountryKeyNameMap();
	const firstCountryNames = countries
		.slice( 0, firstN )
		.map( ( c ) => keyNameMap[ c ] );
	const remainingCount = countries.length - firstCountryNames.length;

	const handleChange = ( v ) => {
		onChange( {
			countries,
			currency,
			price: v,
		} );
	};

	return (
		<div className="gla-countries-price-input">
			<AppInputControl
				label={
					<div className="label">
						<div>
							{ createInterpolateElement(
								__(
									`Shipping rate for <countries /><more />`,
									'google-listings-and-ads'
								),
								{
									countries: (
										<strong>
											{ selectedCountryCodes.length ===
											countries.length
												? __(
														`all countries`,
														'google-listings-and-ads'
												  )
												: firstCountryNames.join(
														', '
												  ) }
										</strong>
									),
									more: <More count={ remainingCount } />,
								}
							) }
						</div>
						<EditRateButton rate={ value } />
					</div>
				}
				suffix={ currency }
				value={ price }
				onChange={ handleChange }
			/>
		</div>
	);
};

export default CountriesPriceInput;
