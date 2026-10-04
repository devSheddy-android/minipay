package com.devsheddy.minipay.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.devsheddy.minipay.models.Wallet;

public interface WalletRepository extends JpaRepository<Wallet, Long> {

    boolean existsByUser_Id(Long userId);

    Optional<Wallet> findByUser_Id(Long userId);
}