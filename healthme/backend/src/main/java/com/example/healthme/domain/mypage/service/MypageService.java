package com.example.healthme.domain.mypage.service;

import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.mypage.dto.AddressUpdate;
import com.example.healthme.domain.mypage.dto.MyPageUserUpdate;
import com.example.healthme.domain.mypage.entity.Address;
import com.example.healthme.domain.mypage.repository.AddressRepository;
import com.example.healthme.domain.user.entity.User;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.healthme.domain.user.repository.UserRepository;

import java.util.List;
import java.util.Optional;

@Service
public class MypageService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AddressRepository addressRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private ApprovalOrderRepository approvalOrderRepository;

    public User getuser(PrincipalDetails principalDetails) {
        Optional<User> op_user = userRepository.findById(principalDetails.getUserDto().getId());

        if(op_user!=null){
            System.out.println("op_user.get" + op_user.get());
            User user = op_user.get();

            return user;
        }
        return null;
    }


    public List<Address> getUserInfo(PrincipalDetails  principalDetails) {
        Long user_id = principalDetails.getUserDto().getId();
        List<Address> op_addr = addressRepository.findByUserId(user_id);
        if(op_addr !=null){
            // System.out.println("optionUser "+optionUser.get());
//            System.out.println("List<Address> op_addr : "+op_addr);
            return op_addr;
        }else{
            return null;
        }

    }

    public void updateUser(Long id, MyPageUserUpdate userUpdate) {
        Optional<User>  optionUser = userRepository.findById(id);
        User user = optionUser.get();
        user.setUserid(userUpdate.getUserid());
        user.setPassword(passwordEncoder.encode(userUpdate.getPassword()));
        user.setUsername(userUpdate.getUsername());
        user.setTel(userUpdate.getPhone());

        userRepository.save(user);
    }

    @Transactional
    public void updateRecipientForUser(Long userId, String recipient) {
        addressRepository.updateRecipientByUserId(userId, recipient);
    }


    // 배송지 수정

    public void updateAddress(Long addrid, PrincipalDetails principalDetails, AddressUpdate addressUpdate) {
        Optional<Address> addr= addressRepository.findById(addrid);

        Address addrUpdateUser = addr.get(); //addr_id에 맞는 한 행 가져온다.
        System.out.println("addrUpdateuser : " +addrUpdateUser);
        if(addrUpdateUser.getUser().getId().equals(principalDetails.getUserDto().getId())){
            // DB(addresses)에서 가져온 행의 user_id와 로그인했을때의 id와 같으면 밑에껄 실행한다.
            addrUpdateUser.setAddress(addressUpdate.getAddress()); // 수정할 주소로 업데이트
            addrUpdateUser.setAddressDetail(addressUpdate.getAddressDetail()); // 수정할 주소로 업데이트
            addrUpdateUser.setZip(addressUpdate.getZonecode()); // 수정할 주소로 업데이트
            addressRepository.save(addrUpdateUser);
            // userRepository.save()만 해도 Address가 이미 DB에서 불러온 객체이면, JPA가 바뀐 내용을 자동으로 감지해서 수정해주기 때문이다.
        }else{

        }

    }

    // 배송지 추가
    public void addnewAddr(AddressUpdate addressUpdate, PrincipalDetails principalDetails) {
        Optional<User> op_user = userRepository.findById(principalDetails.getUserDto().getId());
        User user = op_user.get(); // setUser에 넣기위해서 User 엔터티 들고왔다.


        Address address = new Address();
        address.setAddress(addressUpdate.getAddress());
        address.setAddressDetail(addressUpdate.getAddressDetail());
        address.setRecipient(user.getUsername());
        address.setRecipientPhone(user.getTel());
        address.setZip(addressUpdate.getZonecode());
        address.setIsDefault(false);
        address.setUser(user);

        addressRepository.save(address);
    }


    public List<ApprovalOrder> getbuyproduct(PrincipalDetails principalDetails) {
        String userid= principalDetails.getUsername();

        List<ApprovalOrder> order_li = approvalOrderRepository.findByUseridAndStatus(userid, ApprovalService.STATUS_PAID);
        System.out.println("order_li : "+order_li);
        if(order_li !=null){
            System.out.println("order_li"+order_li);
            return order_li;
        }
        return null;

    }
}

