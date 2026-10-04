package com.devsheddy.minipay.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.devsheddy.minipay.models.Transfer;

public interface TransferRepository extends JpaRepository<Transfer, Long> {

    Optional<Transfer> findByReference(String reference);

    @Query("""
            SELECT t FROM Transfer t
            WHERE t.senderWallet.id = :walletId
               OR t.receiverWallet.id = :walletId
            ORDER BY t.createdAt DESC, t.id DESC
            """)
    List<Transfer> findHistoryByWalletId(@Param("walletId") Long walletId);
}
