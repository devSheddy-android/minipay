package com.devsheddy.minipay.controllers;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.devsheddy.minipay.services.WalletService;
import com.devsheddy.minipay.services.WalletService.WalletSummary;

@RestController
@RequestMapping("/api/wallets")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @PostMapping
    public ResponseEntity<WalletSummary> createWallet(
            @RequestBody CreateWalletRequest request) {

        WalletSummary wallet = walletService.createWallet(request.userId());
        URI location = URI.create("/api/wallets/" + wallet.id());

        return ResponseEntity.created(location).body(wallet);
    }

    @GetMapping("/{walletId}")
    public WalletSummary getWalletById(
            @PathVariable("walletId") Long walletId) {

        return walletService.getWalletById(walletId);
    }

    @GetMapping("/user/{userId}")
    public WalletSummary getWalletByUserId(
            @PathVariable("userId") Long userId) {

        return walletService.getWalletByUserId(userId);
    }

    @PostMapping("/{walletId}/topups")
    public WalletSummary topUpWallet(
            @PathVariable("walletId") Long walletId,
            @RequestBody TopUpRequest request) {

        return walletService.topUpWallet(walletId, request.amount());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(
            IllegalArgumentException exception) {

        return ResponseEntity.badRequest()
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(
            NoSuchElementException exception) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleConflict(
            IllegalStateException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDatabaseConflict(
            DataIntegrityViolationException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message",
                        "Wallet data conflicts with an existing record."));
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleConcurrentUpdate(
            OptimisticLockingFailureException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message",
                        "Wallet was updated by another request. "
                                + "Check its balance before trying again."));
    }

    public record CreateWalletRequest(Long userId) {}

    public record TopUpRequest(BigDecimal amount) {}
}
