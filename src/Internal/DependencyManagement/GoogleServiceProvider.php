<?php
declare( strict_types=1 );

namespace Automattic\WooCommerce\GoogleListingsAndAds\Internal\DependencyManagement;

use Automattic\Jetpack\Connection\Manager;
use Automattic\WooCommerce\GoogleListingsAndAds\API\Google\Merchant;
use Automattic\WooCommerce\GoogleListingsAndAds\API\Google\Proxy;
use Automattic\WooCommerce\GoogleListingsAndAds\Exception\WPError;
use Automattic\WooCommerce\GoogleListingsAndAds\Exception\WPErrorTrait;
use Automattic\WooCommerce\GoogleListingsAndAds\Value\PositiveInteger;
use Google\Client;
use Google_Service_ShoppingContent;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\HandlerStack;
use Jetpack_Options;
use Psr\Http\Message\RequestInterface;

defined( 'ABSPATH' ) || exit;

/**
 * Class GoogleServiceProvider
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\Internal\DependencyManagement
 */
class GoogleServiceProvider extends AbstractServiceProvider {

	use WPErrorTrait;

	/**
	 * Array of classes provided by this container.
	 *
	 * Keys should be the class name, and the value can be anything (like `true`).
	 *
	 * @var array
	 */
	protected $provides = [
		Client::class                         => true,
		Google_Service_ShoppingContent::class => true,
		GuzzleClient::class                   => true,
		Proxy::class                          => true,
		Merchant::class                       => true,
	];

	/**
	 * Use the register method to register items with the container via the
	 * protected $this->leagueContainer property or the `getLeagueContainer` method
	 * from the ContainerAwareTrait.
	 *
	 * @return void
	 */
	public function register() {
		$this->register_guzzle();
		$this->register_google_classes();
		$this->add( Proxy::class, $this->getLeagueContainer() );

		// todo: replace the merchant ID with a stored option.
		$this->add(
			Merchant::class,
			$this->getLeagueContainer(),
			new PositiveInteger( absint( $_GET['merchant_id'] ?? 12345 ) ) // phpcs:ignore WordPress.Security.NonceVerification
		);
	}

	/**
	 * Register guzzle with authorization middleware added.
	 */
	protected function register_guzzle() {
		$callback = function() {
			$handler_stack = HandlerStack::create();

			try {
				$auth_header = $this->generate_guzzle_auth_header();
				$handler_stack->push( $this->add_header( 'Authorization', $auth_header ) );
			} catch ( WPError $error ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
				// Don't do anything with the error here.
			}

			return new GuzzleClient( [ 'handler' => $handler_stack ] );
		};

		$this->share_interface(
			ClientInterface::class,
			$this->getLeagueContainer()->share( GuzzleClient::class, $callback )
		);
	}

	/**
	 * Register the various Google classes we use.
	 */
	protected function register_google_classes() {
		$this->add( Client::class )->addMethodCall( 'setHttpClient', [ ClientInterface::class ] );
		$this->add( Google_Service_ShoppingContent::class, Client::class, $this->get_connect_server_url_root() );
	}

	/**
	 * @param string $header
	 * @param string $value
	 *
	 * @return callable
	 */
	protected function add_header( string $header, string $value ): callable {
		return function( callable $handler ) use ( $header, $value ) {
			return function( RequestInterface $request, array $options ) use ( $handler, $header, $value ) {
				$request = $request->withHeader( $header, $value );

				return $handler( $request, $options );
			};
		};
	}

	/**
	 * Generate the authorization header for the Guzzle client.
	 *
	 * @return string
	 */
	protected function generate_guzzle_auth_header(): string {
		/** @var Manager $manager */
		$manager = $this->getLeagueContainer()->get( Manager::class );
		$token   = $manager->get_access_token( false, false, false );
		$this->check_for_wp_error( $token );

		[ $key, $secret ] = explode( '.', $token->secret );

		$key       = sprintf(
			'%s:%d:%d',
			$key,
			defined( 'JETPACK__API_VERSION' ) ? JETPACK__API_VERSION : 1,
			$token->external_user_id
		);
		$timestamp = time() + (int) Jetpack_Options::get_option( 'time_diff' );
		$nonce     = wp_generate_password( 10, false );

		$request   = join( "\n", [ $key, $timestamp, $nonce, '' ] );
		$signature = base64_encode( hash_hmac( 'sha1', $request, $secret, true ) );
		$auth      = [
			'token'     => $key,
			'timestamp' => $timestamp,
			'nonce'     => $nonce,
			'signature' => $signature,
		];

		$pieces = [ 'X_JP_Auth' ];
		foreach ( $auth as $key => $value ) {
			$pieces[] = sprintf( '%s="%s"', $key, $value );
		}

		return join( ' ', $pieces );
	}

	/**
	 * Get the root Url for the connect server.
	 *
	 * @return string
	 */
	protected function get_connect_server_url_root(): string {
		$url = defined( 'WOOCOMMERCE_CONNECT_SERVER_URL' )
			? WOOCOMMERCE_CONNECT_SERVER_URL
			: 'https://api.woocommerce.com/';
		$url = rtrim( $url, '/' );

		return "{$url}/google/google-mc";
	}
}
