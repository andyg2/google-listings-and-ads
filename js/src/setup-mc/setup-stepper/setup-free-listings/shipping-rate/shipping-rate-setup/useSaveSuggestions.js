/**
 * External dependencies
 */
import { useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import useDispatchCoreNotices from '.~/hooks/useDispatchCoreNotices';
import { useAppDispatch } from '.~/data';

/**
 * A hook that returns a `saveSuggestions` callback.
 *
 * If there is an error during saving suggestions,
 * it will display an error notice in the UI.
 *
 * @return {Function} `saveSuggestions` function to save suggestions as shipping rates.
 */
const useSaveSuggestions = () => {
	const { createNotice } = useDispatchCoreNotices();
	const { upsertShippingRates } = useAppDispatch();

	const saveSuggestions = useCallback(
		async ( suggestions ) => {
			try {
				await upsertShippingRates( suggestions );
			} catch ( error ) {
				createNotice(
					'error',
					__(
						`Unable to use your WooCommerce shipping settings as shipping rates in Google. You may have to enter shipping rates manually.`,
						'google-listings-and-ads'
					)
				);
			}
		},
		[ createNotice, upsertShippingRates ]
	);

	return saveSuggestions;
};

export default useSaveSuggestions;
