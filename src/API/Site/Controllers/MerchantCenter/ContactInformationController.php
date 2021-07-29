<?php
declare( strict_types=1 );

namespace Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\MerchantCenter;

use Automattic\WooCommerce\GoogleListingsAndAds\API\Google\Merchant;
use Automattic\WooCommerce\GoogleListingsAndAds\API\Google\Settings;
use Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\BaseOptionsController;
use Automattic\WooCommerce\GoogleListingsAndAds\API\TransportMethods;
use Automattic\WooCommerce\GoogleListingsAndAds\Exception\MerchantApiException;
use Automattic\WooCommerce\GoogleListingsAndAds\MerchantCenter\MerchantVerification;
use Automattic\WooCommerce\GoogleListingsAndAds\Proxies\RESTServer;
use Google\Service\ShoppingContent\AccountAddress;
use Google\Service\ShoppingContent\AccountBusinessInformation;
use WP_Error;
use WP_REST_Request as Request;
use WP_REST_Response as Response;

defined( 'ABSPATH' ) || exit;

/**
 * Class ContactInformationController
 *
 * @since x.x.x
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\MerchantCenter
 */
class ContactInformationController extends BaseOptionsController {

	/**
	 * @var Merchant $merchant_verification
	 */
	protected $merchant_verification;

	/**
	 * @var Settings
	 */
	protected $settings;

	/**
	 * ContactInformationController constructor.
	 *
	 * @param RESTServer           $server
	 * @param MerchantVerification $merchant_verification
	 * @param Settings             $settings
	 */
	public function __construct( RESTServer $server, MerchantVerification $merchant_verification, Settings $settings ) {
		parent::__construct( $server );
		$this->merchant_verification = $merchant_verification;
		$this->settings              = $settings;
	}

	/**
	 * Register rest routes with WordPress.
	 */
	public function register_routes(): void {
		$this->register_route(
			'mc/contact-information',
			[
				[
					'methods'             => TransportMethods::READABLE,
					'callback'            => $this->get_contact_information_endpoint_read_callback(),
					'permission_callback' => $this->get_permission_callback(),
				],
				[
					'methods'             => TransportMethods::CREATABLE,
					'callback'            => $this->get_contact_information_endpoint_edit_callback(),
					'permission_callback' => $this->get_permission_callback(),
					'args'                => $this->get_update_args(),
				],
				'schema' => $this->get_api_response_schema_callback(),
			]
		);
	}

	/**
	 * Get a callback for the contact information endpoint.
	 *
	 * @return callable
	 */
	protected function get_contact_information_endpoint_read_callback(): callable {
		return function ( Request $request ) {
			try {
				return $this->get_contact_information_response(
					$this->merchant_verification->get_contact_information(),
					$request
				);
			} catch ( MerchantApiException $e ) {
				return new Response( [ 'message' => $e->getMessage() ], $e->getCode() ?: 400 );
			}
		};
	}

	/**
	 * Get a callback for the edit contact information endpoint.
	 *
	 * @return callable
	 */
	protected function get_contact_information_endpoint_edit_callback(): callable {
		return function ( Request $request ) {
			try {
				return $this->get_contact_information_response(
					$this->merchant_verification->update_contact_information( $request['phone_number'] ),
					$request
				);
			} catch ( MerchantApiException $e ) {
				return new Response( [ 'message' => $e->getMessage() ], $e->getCode() ?: 400 );
			}
		};
	}

	/**
	 * Get the schema for contact information endpoints.
	 *
	 * @return array
	 */
	protected function get_schema_properties(): array {
		return [
			'id'                      => [
				'type'              => 'integer',
				'description'       => __( 'The Merchant Center account ID.', 'google-listings-and-ads' ),
				'context'           => [ 'view', 'edit' ],
				'validate_callback' => 'rest_validate_request_arg',
			],
			'phone_number'            => [
				'type'              => 'string',
				'description'       => __( 'The phone number associated with the Merchant Center account.', 'google-listings-and-ads' ),
				'context'           => [ 'view', 'edit' ],
				'validate_callback' => 'rest_validate_request_arg',
			],
			'mc_address'              => [
				'type'        => 'object',
				'description' => __( 'The address associated with the Merchant Center account.', 'google-listings-and-ads' ),
				'context'     => [ 'view' ],
				'properties'  => $this->get_address_schema(),
			],
			'wc_address'              => [
				'type'        => 'object',
				'description' => __( 'The WooCommerce store address.', 'google-listings-and-ads' ),
				'context'     => [ 'view' ],
				'properties'  => $this->get_address_schema(),
			],
			'is_mc_address_different' => [
				'type'        => 'boolean',
				'description' => __( 'Whether the Merchant Center account address is different than the WooCommerce store address.', 'google-listings-and-ads' ),
				'context'     => [ 'view' ],
			],
		];
	}

	/**
	 * Get the schema for addresses returned by the contact information endpoints.
	 *
	 * @return array[]
	 */
	protected function get_address_schema(): array {
		return [
			'street_address' => [
				'description' => __( 'Street-level part of the address.', 'google-listings-and-ads' ),
				'type'        => 'string',
				'context'     => [ 'view' ],
			],
			'locality'       => [
				'description' => __( 'City, town or commune. May also include dependent localities or sublocalities (e.g. neighborhoods or suburbs).', 'google-listings-and-ads' ),
				'type'        => 'string',
				'context'     => [ 'view' ],
			],
			'region'         => [
				'description' => __( 'Top-level administrative subdivision of the country. For example, a state like California ("CA") or a province like Quebec ("QC").', 'google-listings-and-ads' ),
				'type'        => 'string',
				'context'     => [ 'view' ],
			],
			'postal_code'    => [
				'description' => __( 'Postal code or ZIP (e.g. "94043").', 'google-listings-and-ads' ),
				'type'        => 'string',
				'context'     => [ 'view' ],
			],
			'country'        => [
				'description' => __( 'CLDR country code (e.g. "US").', 'google-listings-and-ads' ),
				'type'        => 'string',
				'context'     => [ 'view' ],
			],
		];
	}

	/**
	 * Get the arguments for the update endpoint.
	 *
	 * @return array
	 */
	public function get_update_args(): array {
		return [
			'context'      => $this->get_context_param( [ 'default' => 'view' ] ),
			'phone_number' => [
				'description'       => __( 'The new phone number to assign to the account.', 'google-listings-and-ads' ),
				'type'              => [ 'integer', 'string' ],
				'validate_callback' => $this->get_phone_number_validate_callback(),
				'sanitize_callback' => $this->get_phone_number_sanitize_callback(),
			],
		];
	}

	/**
	 * Get the prepared REST response with Merchant Center account ID and contact information.
	 *
	 * @param AccountBusinessInformation|null $contact_information
	 * @param Request                         $request
	 *
	 * @return Response
	 */
	protected function get_contact_information_response( ?AccountBusinessInformation $contact_information, Request $request ): Response {
		return $this->prepare_item_for_response(
			[
				'id'                      => $this->options->get_merchant_id(),
				'phone_number'            => $contact_information->getPhoneNumber(),
				'mc_address'              => self::serialize_address( $contact_information->getAddress() ),
				'wc_address'              => self::serialize_address( $this->settings->get_store_address() ),
				'is_mc_address_different' => ! self::compare_addresses( $contact_information->getAddress(), $this->settings->get_store_address() ),
			],
			$request
		);
	}

	/**
	 * @param AccountAddress|null $address
	 *
	 * @return array|null
	 */
	protected static function serialize_address( ?AccountAddress $address ): ?array {
		if ( null === $address ) {
			return null;
		}

		return [
			'street_address' => $address->getStreetAddress(),
			'locality'       => $address->getLocality(),
			'region'         => $address->getRegion(),
			'postal_code'    => $address->getPostalCode(),
			'country'        => $address->getCountry(),
		];
	}

	/**
	 * Checks whether two account addresses are the same and returns true if they are.
	 *
	 * @param AccountAddress|null $address_1
	 * @param AccountAddress|null $address_2
	 *
	 * @return bool True if the two addresses are the same, false otherwise.
	 */
	protected static function compare_addresses( ?AccountAddress $address_1, ?AccountAddress $address_2 ): bool {
		if ( $address_1 instanceof AccountAddress && $address_2 instanceof AccountAddress ) {
			$cmp_street_address = $address_1->getStreetAddress() === $address_2->getStreetAddress();
			$cmp_locality       = $address_1->getLocality() === $address_2->getLocality();
			$cmp_region         = $address_1->getRegion() === $address_2->getRegion();
			$cmp_postal_code    = $address_1->getPostalCode() === $address_2->getPostalCode();
			$cmp_country        = $address_1->getCountry() === $address_2->getCountry();

			return $cmp_street_address && $cmp_locality && $cmp_region && $cmp_postal_code && $cmp_country;
		}

		return $address_1 === $address_2;
	}

	/**
	 * Get the item schema name for the controller.
	 *
	 * Used for building the API response schema.
	 *
	 * @return string
	 */
	protected function get_schema_title(): string {
		return 'merchant_center_contact_information';
	}

	/**
	 * Get the callback to sanitize the phone number, leaving only `+` (plus) and numbers.
	 *
	 * @return callable
	 */
	protected function get_phone_number_sanitize_callback(): callable {
		return function ( $phone_number ) {
			return $this->merchant_verification->sanitize_phone_number( $phone_number );
		};
	}

	/**
	 * Validate that the phone number doesn't contain invalid characters.
	 * Allowed: ()-.0123456789 and space
	 *
	 * @return callable
	 */
	protected function get_phone_number_validate_callback() {
		return function ( $value, $request, $param ) {
			return $this->merchant_verification->validate_phone_number( $value )
				? rest_validate_request_arg( $value, $request, $param )
				: new WP_Error( 'rest_empty_phone_number', __( 'Invalid phone number.', 'google-listings-and-ads' ) );
		};
	}
}
