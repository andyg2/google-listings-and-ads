<?php
declare( strict_types=1 );

namespace Automattic\WooCommerce\GoogleListingsAndAds\Proxies;

/**
 * Class GoogleGtagJs
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\Proxies
 */
class GoogleGtagJs {

	/** @var array */
	private $wcga_settings;

	/**
	 * GoogleGtagJs constructor.
	 *
	 * Load the WooCommerce Google Analytics Integration extension settings.
	 */
	public function __construct() {
		$this->wcga_settings = get_option( 'woocommerce_google_analytics_settings', [] );

		// Prime some values.
		if ( empty( $this->wcga_settings['ga_gtag_enabled'] ) ) {
			$this->wcga_settings['ga_gtag_enabled'] = 'no';
		}
		if ( empty( $this->wcga_settings['ga_standard_tracking_enabled'] ) ) {
			$this->wcga_settings['ga_standard_tracking_enabled'] = 'no';
		}
		if ( empty( $this->wcga_settings['ga_id'] ) ) {
			$this->wcga_settings['ga_id'] = null;
		}
	}

	/**
	 * Determine whether WooCommerce Google Analytics Integration is already
	 * injecting the gtag <script> code.
	 *
	 * @return bool True if the <script> code is present.
	 */
	public function is_adding_framework() {
		// WooCommerce Google Analytics Integration is disabled for admin users.
		$is_admin = is_admin() || current_user_can( 'manage_options' );

		return ! $is_admin && class_exists( '\WC_Google_Gtag_JS' ) && $this->is_gtag_page() && $this->has_required_settings();
	}

	/**
	 * Determine whether the current page has WooCommerce Google Analytics Integration enabled.
	 *
	 * @return bool If the page is a Analytics-enabled page.
	 */
	private function is_gtag_page(): bool {
		$standard_tracking_enabled = 'yes' === $this->wcga_settings['ga_standard_tracking_enabled'];
		$is_wc_page                = is_order_received_page() || is_woocommerce() || is_cart() || is_checkout() || || is_product();

		return $standard_tracking_enabled || $is_wc_page;
	}

	/**
	 * In order for WooCommerce Google Analytics Integration to include the Global Site Tag
	 * framework, it needs to be enabled in the settings and a Measurement ID must be provided.
	 *
	 * @return bool True if Global Site Tag is enabled and a Measurement ID is provided.
	 */
	private function has_required_settings() {
		return 'yes' === $this->wcga_settings['ga_gtag_enabled'] && $this->wcga_settings['ga_id'];
	}
}
