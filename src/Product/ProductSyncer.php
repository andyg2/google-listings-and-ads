<?php

namespace Automattic\WooCommerce\GoogleListingsAndAds\Product;

use Automattic\WooCommerce\GoogleListingsAndAds\Google\BatchDeleteProductResponse;
use Automattic\WooCommerce\GoogleListingsAndAds\Google\BatchProductRequestEntry;
use Automattic\WooCommerce\GoogleListingsAndAds\Google\BatchUpdateProductResponse;
use Automattic\WooCommerce\GoogleListingsAndAds\Google\GoogleProductService;
use Automattic\WooCommerce\GoogleListingsAndAds\Google\InvalidProductEntry;
use Automattic\WooCommerce\GoogleListingsAndAds\Infrastructure\Service;
use Google_Exception;
use Google_Service_ShoppingContent_Product as GoogleProduct;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use WC_Product;

/**
 * Class ProductSyncer
 *
 * @package Automattic\WooCommerce\GoogleListingsAndAds\Product
 */
class ProductSyncer implements Service {

	/**
	 * @var GoogleProductService
	 */
	protected $google_service;

	/**
	 * @var ProductMetaHandler
	 */
	protected $meta_handler;

	/**
	 * @var ProductHelper
	 */
	protected $product_helper;

	/**
	 * @var ValidatorInterface
	 */
	protected $validator;

	/**
	 * ProductSyncer constructor.
	 *
	 * @param GoogleProductService $google_service
	 * @param ProductMetaHandler   $meta_handler
	 * @param ProductHelper        $product_helper
	 * @param ValidatorInterface   $validator
	 */
	public function __construct(
		GoogleProductService $google_service,
		ProductMetaHandler $meta_handler,
		ProductHelper $product_helper,
		ValidatorInterface $validator
	) {
		$this->google_service = $google_service;
		$this->meta_handler   = $meta_handler;
		$this->product_helper = $product_helper;
		$this->validator      = $validator;
	}

	/**
	 * Submits a WooCommerce product to Google Merchant Center.
	 *
	 * @param WC_Product $product
	 *
	 * @throws ProductSyncerException If there are any errors while syncing products with Google Merchant Center.
	 */
	public function update( WC_Product $product ) {
		$google_product = ProductHelper::generate_adapted_product( $product );

		$validation_result = $this->validate_product( $google_product );
		if ( $validation_result instanceof InvalidProductEntry ) {
			throw new ProductSyncerException(
				sprintf(
					"Product with ID %s does not meet the Google Merchant Center requirements:\n%s",
					$product->get_id(),
					implode( "\n", $validation_result->get_errors() )
				)
			);
		}

		try {
			$updated_product = $this->google_service->insert( $google_product );

			$this->update_metas( $product->get_id(), $updated_product );
		} catch ( Google_Exception $exception ) {
			throw new ProductSyncerException( sprintf( 'Error updating Google product: %s', $exception->getMessage() ), 0, $exception );
		}
	}

	/**
	 * Submits an array of WooCommerce products to Google Merchant Center.
	 *
	 * @param WC_Product[] $products
	 *
	 * @return BatchUpdateProductResponse Containing both the synced and invalid products.
	 *
	 * @throws ProductSyncerException If there are any errors while syncing products with Google Merchant Center.
	 */
	public function update_many( array $products ): BatchUpdateProductResponse {
		// prepare and validate products
		$products         = ProductHelper::expand_variations( $products );
		$updated_products = [];
		$invalid_products = [];
		$product_entries  = [];
		foreach ( $products as $product ) {
			$adapted_product   = ProductHelper::generate_adapted_product( $product );
			$validation_result = $this->validate_product( $adapted_product );
			if ( $validation_result instanceof InvalidProductEntry ) {
				$invalid_products[] = $validation_result;
			} else {
				$product_entries[] = new BatchProductRequestEntry( $product->get_id(), $adapted_product );
			}
		}

		// bail if no valid products provided
		if ( empty( $product_entries ) ) {
			return new BatchUpdateProductResponse( [], $invalid_products );
		}

		foreach ( array_chunk( $product_entries, GoogleProductService::BATCH_SIZE ) as $product_entries ) {
			try {
				$response = $this->google_service->insert_batch( $product_entries );

				$updated_products = array_merge( $updated_products, $response->get_updated_products() );
				$invalid_products = array_merge( $invalid_products, $response->get_invalid_products() );

				// update the meta data for the synced products
				array_walk(
					$updated_products,
					function ( $updated_product ) {
						$this->update_metas( $updated_product->getOfferId(), $updated_product );
					}
				);
			} catch ( Google_Exception $exception ) {
				throw new ProductSyncerException( sprintf( 'Error updating Google product: %s', $exception->getMessage() ), 0, $exception );
			}
		}

		return new BatchUpdateProductResponse( $updated_products, $invalid_products );
	}

	/**
	 * Deletes a WooCommerce product from Google Merchant Center.
	 *
	 * @param WC_Product $product
	 *
	 * @throws ProductSyncerException If there are any errors while deleting products from Google Merchant Center.
	 */
	public function delete( WC_Product $product ) {
		$google_product = ProductHelper::generate_adapted_product( $product );

		try {
			$this->google_service->delete( $google_product );

			$this->delete_metas( $product->get_id() );
		} catch ( Google_Exception $exception ) {
			throw new ProductSyncerException( sprintf( 'Error deleting Google product: %s', $exception->getMessage() ), 0, $exception );
		}
	}

	/**
	 * Deletes an array of WooCommerce products from Google Merchant Center.
	 *
	 * @param WC_Product[] $products
	 *
	 * @return BatchDeleteProductResponse Containing both the deleted and invalid products.
	 *
	 * @throws ProductSyncerException If there are any errors while deleting products from Google Merchant Center.
	 */
	public function delete_many( array $products ): BatchDeleteProductResponse {
		$deleted_product_ids = [];
		$invalid_products    = [];

		$products = ProductHelper::expand_variations( $products );

		// filter the synced products
		$synced_products = array_filter( $products, [ $this->product_helper, 'is_product_synced' ] );

		// return empty response if no synced product found
		if ( empty( $synced_products ) ) {
			return new BatchDeleteProductResponse( [], [] );
		}

		foreach ( array_chunk( $synced_products, GoogleProductService::BATCH_SIZE ) as $products_batch ) {
			$product_entries = $this->generate_delete_request_entries( $products_batch );
			try {
				$response = $this->google_service->delete_batch( $product_entries );

				$deleted_product_ids = array_merge( $deleted_product_ids, $response->get_deleted_product_ids() );
				$invalid_products    = array_merge( $invalid_products, $response->get_invalid_products() );

				array_walk( $deleted_product_ids, [ $this, 'delete_metas' ] );
			} catch ( Google_Exception $exception ) {
				throw new ProductSyncerException( sprintf( 'Error deleting Google products: %s', $exception->getMessage() ), 0, $exception );
			}
		}

		return new BatchDeleteProductResponse( $deleted_product_ids, $invalid_products );
	}

	/**
	 * @param int           $wc_product_id WooCommerce product ID
	 * @param GoogleProduct $google_product
	 */
	protected function update_metas( int $wc_product_id, GoogleProduct $google_product ) {
		$this->meta_handler->update_synced_at( $wc_product_id, time() );
		$this->meta_handler->update_google_id( $wc_product_id, $google_product->getId() );
	}

	/**
	 * @param int $wc_product_id WooCommerce product ID
	 */
	protected function delete_metas( int $wc_product_id ) {
		$this->meta_handler->delete_synced_at( $wc_product_id );
		$this->meta_handler->delete_google_id( $wc_product_id );
	}

	/**
	 * Generates an array map containing the Google product IDs as key and the WooCommerce product IDs as values.
	 *
	 * @param WC_Product[] $products
	 *
	 * @return array
	 */
	protected function generate_delete_request_entries( array $products ): array {
		return array_map(
			function ( WC_Product $product ) {
				return new BatchProductRequestEntry(
					$product->get_id(),
					$this->product_helper->get_synced_google_product_id( $product )
				);
			},
			$products
		);
	}

	/**
	 * @param WCProductAdapter $product
	 *
	 * @return InvalidProductEntry|true
	 */
	protected function validate_product( WCProductAdapter $product ) {
		$violations = $this->validator->validate( $product );

		if ( 0 !== count( $violations ) ) {
			$invalid_product = new InvalidProductEntry( $product->get_wc_product()->get_id() );
			$invalid_product->map_validation_violations( $violations );

			return $invalid_product;
		}

		return true;
	}
}
