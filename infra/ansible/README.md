# build a server

## install debian in a VPS

Boot the following ISO file on the VPS.

https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-11.5.0-amd64-netinst.iso

## installation

- Create a security group to allow SSH only from my own IP address.
- Create "system" user as a general user.

## sshd configuration

Connect to the server with password authentication.

Place yantene's public key as the login key for "system" user.

```bash
mkdir -m700 /home/system/.ssh
vi /home/system/.ssh/authorized_keys
```

Prohibit password login and root login.

Run as root.

```bash
echo -e "PasswordAuthentication no\nPermitRootLogin no" > /etc/ssh/sshd_config.d/prohibit_root_and_password_login.conf
systemctl restart sshd.service
```

Create the "wheel" group and make the "system" user belong to it.

Run as root.

```bash
apt install sudo
echo "%wheel ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/nopasswd-wheel
/usr/sbin/groupadd wheel
gpasswd -a system wheel
```

## provision

Check.

```bash
ansible-playbook \
  -i ./hosts/production.yml \
  ./default.yml \
  --check
```

Provision.

```bash
ansible-playbook \
  -i ./hosts/production.yml \
  ./default.yml
```
