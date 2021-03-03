<?php
declare( strict_types=1 );

namespace Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\Ads;

use Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\BaseController;
use Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\CountryCodeTrait;
use Automattic\WooCommerce\GoogleListingsAndAds\API\TransportMethods;
use Automattic\WooCommerce\GoogleListingsAndAds\DB\Query\BudgetRecommendationQuery;
use Automattic\WooCommerce\GoogleListingsAndAds\Internal\Interfaces\ISO3166AwareInterface;
use Automattic\WooCommerce\GoogleListingsAndAds\Proxies\RESTServer;
use Exception;
use Psr\Container\ContainerInterface;
use WP_REST_Request as Request;
use WP_REST_Response as Response;

defined( 'ABSPATH' ) || exit;

/**
 * Class BudgetRecommendationController
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\API\Site\Controllers\Ads
 */
class BudgetRecommendationController extends BaseController implements ISO3166AwareInterface {

	use CountryCodeTrait;

	/**
	 * @var BudgetRecommendationQuery
	 */
	protected $budget_recommendation_query;

	/**
	 * BudgetRecommendationController constructor.
	 *
	 * @param RESTServer                $rest_server
	 * @param BudgetRecommendationQuery $budget_recommendation_query
	 */
	public function __construct( RESTServer $rest_server, BudgetRecommendationQuery $budget_recommendation_query ) {
		parent::__construct( $rest_server );
		$this->budget_recommendation_query = $budget_recommendation_query;
	}

	/**
	 * Register rest routes with WordPress.
	 */
	public function register_routes(): void {
		$this->register_route(
			'ads/campaigns/budget-recommendation/(?P<country_code>\\w{2})',
			[
				[
					'methods'             => TransportMethods::READABLE,
					'callback'            => $this->get_budget_recommendation_callback(),
					'permission_callback' => $this->get_permission_callback(),
				],
				'schema' => $this->get_api_response_schema_callback(),
			]
		);
	}
	/**
	 * @return callable
	 */
	protected function get_budget_recommendation_callback(): callable {
		return function( Request $request ) {
			$country        = $request->get_param( 'country_code' );
			$currency       = get_woocommerce_currency();
			$recommendation = $this
				->budget_recommendation_query
				->where( 'country', $country )
				->where( 'currency', $currency )
				->get_results();

			if ( ! $recommendation || 1 !== count( $recommendation ) ) {
				return new Response(
					[
						'message'      => __( 'Invalid country/currency combination', 'google-listings-and-ads' ),
						'currency'     => $currency,
						'country_code' => $country,
					],
					400
				);
			}

			return $this->prepare_item_for_response(
				[
					'currency'          => $recommendation[0]['currency'],
					'country_code'      => $recommendation[0]['country'],
					'daily_budget_low'  => $recommendation[0]['daily_budget_low'],
					'daily_budget_high' => $recommendation[0]['daily_budget_high'],
				],
				$request
			);
		};
	}

	/**
	 * Get the item schema for the controller.
	 *
	 * @return array
	 */
	protected function get_schema_properties(): array {
		return [
			'currency'          => [
				'type'              => 'string',
				'description'       => __( 'The currency to use for the shipping rate.', 'google-listings-and-ads' ),
				'context'           => [ 'view' ],
				'validate_callback' => 'rest_validate_request_arg',
				'required'          => true,
			],
			'country_code'      => [
				'type'              => 'string',
				'description'       => __( 'Country code in ISO 3166-1 alpha-2 format.', 'google-listings-and-ads' ),
				'context'           => [ 'view' ],
				'sanitize_callback' => $this->get_country_code_sanitize_callback(),
				'validate_callback' => $this->get_country_code_validate_callback(),
				'required'          => true,
			],
			'daily_budget_low'  => [
				'type'              => 'number',
				'description'       => __( 'The lower limit for the recommended budget.', 'google-listings-and-ads' ),
				'context'           => [ 'view' ],
				'validate_callback' => 'rest_validate_request_arg',
				'required'          => true,
			],
			'daily_budget_high' => [
				'type'              => 'number',
				'description'       => __( 'The upper limit for the recommended budget.', 'google-listings-and-ads' ),
				'context'           => [ 'view' ],
				'validate_callback' => 'rest_validate_request_arg',
				'required'          => true,
			],
		];
	}

	/**
	 * Get the item schema name for the controller.
	 *
	 * Used for building the API response schema.
	 *
	 * @return string
	 */
	protected function get_schema_title(): string {
		return 'budget-recommendation';
	}
}
