FROM ubuntu:precise
RUN echo "deb http://archive.ubuntu.com/ubuntu precise universe" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y python-software-properties python g++ make 
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update
RUN apt-get install -y nodejs
ADD . ./restore
RUN cd restore && npm install

CMD cd restore && node restore.js
EXPOSE 8000
