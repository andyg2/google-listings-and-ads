/**
 * External dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import GridiconPlusSmall from 'gridicons/dist/plus-small';

/**
 * Internal dependencies
 */
import AppButtonModalTrigger from '.~/components/app-button-modal-trigger';
import VerticalGapLayout from '.~/components/vertical-gap-layout';
import groupShippingRatesByPriceCurrency from '.~/utils/groupShippingRatesByPriceCurrency';
import CountriesPriceInput from './countries-price-input';
import AddRateModal from './add-rate-modal';

const defaultShippingRate = {
	method: 'flat_rate',
	options: {},
};

/**
 * Partial form to provide shipping rates for individual countries,
 * with an UI, that allows to aggregate countries with the same rate.
 *
 * @param {Object} props
 * @param {Array<ShippingRateFromServerSide>} props.value Array of individual shipping rates to be used as the initial values of the form.
 * @param {string} props.currencyCode Shop's currency code.
 * @param {Array<CountryCode>} props.audienceCountries Array of country codes of all audience countries.
 * @param {(newValue: Object) => void} props.onChange Callback called with new data once shipping rates are changed.
 */
export default function ShippingCountriesForm( {
	value: shippingRates,
	currencyCode,
	audienceCountries,
	onChange,
} ) {
	const actualCountryCount = shippingRates.length;
	const actualCountries = new Map(
		shippingRates.map( ( rate ) => [ rate.country, rate ] )
	);
	const remainingCountries = audienceCountries.filter(
		( el ) => ! actualCountries.has( el )
	);
	const remainingCount = remainingCountries.length;
	// We may have shipping rates defined for more than the audience countries.
	// Therefore, the number of countries we anticipate is what we acutally have + missing audience ones.
	const totalCountyCount = actualCountryCount + remainingCount;

	// Group countries with the same rate.
	const countriesPriceArray = groupShippingRatesByPriceCurrency(
		shippingRates
	);

	// Prefill to-be-added price.
	if ( countriesPriceArray.length === 0 ) {
		countriesPriceArray.push( {
			countries: audienceCountries,
			price: null,
			currency: currencyCode,
		} );
	}

	// Given the limitations of `<Form>` component we can communicate up only onChange.
	// Therefore we loose the infromation whether it was add, change, delete.
	// In autosave/setup MC case, we would have to either re-calculate to deduct that information,
	// or fix that in `<Form>` component.
	function handleDelete( deletedCountries ) {
		onChange(
			shippingRates.filter(
				( rate ) => ! deletedCountries.includes( rate.country )
			)
		);
	}
	function handleAdd( { countries, currency, rate } ) {
		// Split aggregated rate, to individial rates per country.
		const addedIndividualRates = countries.map( ( country ) => ( {
			...defaultShippingRate,
			country,
			currency,
			rate, // TODO: unify that
		} ) );

		onChange( shippingRates.concat( addedIndividualRates ) );
	}
	function handleChange(
		{ countries, currency, price },
		deletedCountries = []
	) {
		deletedCountries.forEach( ( country ) =>
			actualCountries.delete( country )
		);

		// Upsert rates.
		countries.forEach( ( country ) => {
			const oldShippingRate = actualCountries.get( country );
			const newShippingrate = {
				...oldShippingRate,
				country,
				currency,
				rate: price, // TODO: unify that
			};

			actualCountries.set( country, newShippingrate );
		} );
		onChange( Array.from( actualCountries.values() ) );
	}

	return (
		<div className="countries-price">
			<VerticalGapLayout size="large">
				{ countriesPriceArray.map( ( el ) => {
					return (
						<div
							key={ el.countries.join( '-' ) }
							className="countries-price-input-form"
						>
							<CountriesPriceInput
								value={ el }
								audienceCountries={ audienceCountries }
								totalCountyCount={ totalCountyCount }
								onChange={ handleChange }
								onDelete={ handleDelete }
							/>
						</div>
					);
				} ) }
				{ actualCountryCount >= 1 && remainingCount >= 1 && (
					<div className="add-rate-button">
						<AppButtonModalTrigger
							button={
								<Button
									isSecondary
									icon={ <GridiconPlusSmall /> }
								>
									{ __(
										'Add another rate',
										'google-listings-and-ads'
									) }
								</Button>
							}
							modal={
								<AddRateModal
									countries={ remainingCountries }
									onSubmit={ handleAdd }
								/>
							}
						/>
					</div>
				) }
			</VerticalGapLayout>
		</div>
	);
}

/**
 * Individual shipping rate.
 *
 * @typedef {Object} ShippingRate
 * @property {CountryCode} country Destination country code.
 * @property {string} currency Currency of the price.
 * @property {number} price Shipping price.
 */

/**
 * Aggregated shipping rate.
 *
 * @typedef {Object} AggregatedShippingRate
 * @property {Array<CountryCode>} countries Array of destination country codes.
 * @property {string} currency Currency of the price.
 * @property {number} price Shipping price.
 */

/**
 * @typedef { import(".~/data/actions").ShippingRate } ShippingRateFromServerSide
 * @typedef { import(".~/data/actions").CountryCode } CountryCode
 */
